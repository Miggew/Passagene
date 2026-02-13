#!/usr/bin/env python3
"""
bootstrap_atlas.py — Popular atlas com datasets públicos cross-species.

Executar UMA VEZ antes do primeiro uso do sistema.
Requer:
  - DINOv2 Cloud Run deployado e rodando
  - Supabase com migration v2 aplicada (embryo_references + pgvector)
  - Datasets baixados localmente:
      ./datasets/kromp/   (Kromp et al. 2023 — 2.344 blastocistos humanos)
      ./datasets/rocha/   (Rocha et al. 2017 — 482 blastocistos bovinos)

Env vars:
  DINOV2_CLOUD_RUN_URL  — URL do serviço DINOv2
  SUPABASE_URL          — URL do projeto Supabase
  SUPABASE_SERVICE_KEY  — Service role key (para bypass RLS)

Usage:
  pip install requests pandas openpyxl xlrd
  python scripts/bootstrap_atlas.py
"""

import os
import sys
import json
import time
import base64
import requests
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

# ─── Config ───

DINOV2_URL = os.environ.get("DINOV2_CLOUD_RUN_URL", "")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
LAB_ID = "00000000-0000-0000-0000-000000000001"  # Single lab for now

BATCH_SIZE = 50  # Insert batch size for Supabase
MAX_WORKERS = 4  # Parallel DINOv2 calls

if not DINOV2_URL or not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: Set DINOV2_CLOUD_RUN_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY")
    sys.exit(1)

SUPABASE_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

# ─── Classification mappings ───

# Kromp numeric ICM/TE → Gardner letter → PassaGene
# ICM: 1=A, 2=B, 3=C, 0=not determinable
# TE:  1=a, 2=b, 3=c, 0=not determinable
ICM_NUM_TO_LETTER = {"1": "A", "2": "B", "3": "C"}
TE_NUM_TO_LETTER = {"1": "a", "2": "b", "3": "c"}

GARDNER_TO_PASSAGENE = {
    ("A", "a"): "BE", ("A", "b"): "BN", ("A", "c"): "BX",
    ("B", "a"): "BN", ("B", "b"): "BX", ("B", "c"): "BL",
    ("C", "a"): "BX", ("C", "b"): "BL", ("C", "c"): "BI",
}

# IETS grade → PassaGene
IETS_TO_PASSAGENE = {
    1: "BE",  # Excellent/Good
    2: "BN",  # Fair (conservative)
    3: "BI",  # Poor
    4: "Dg",  # Degenerate
}


def get_embedding(image_path: str) -> dict | None:
    """Send single image to DINOv2 Cloud Run /embed-single and get embedding."""
    try:
        with open(image_path, "rb") as f:
            img_b64 = base64.b64encode(f.read()).decode()

        resp = requests.post(
            f"{DINOV2_URL}/embed-single",
            data={"image_b64": img_b64},
            timeout=120,
        )
        resp.raise_for_status()
        data = resp.json()
        return data
    except Exception as e:
        print(f"  ERROR embedding {Path(image_path).name}: {e}")
        return None


def insert_references(refs: list[dict]):
    """Batch insert into embryo_references via Supabase REST API."""
    url = f"{SUPABASE_URL}/rest/v1/embryo_references"
    for i in range(0, len(refs), BATCH_SIZE):
        batch = refs[i : i + BATCH_SIZE]
        resp = requests.post(url, headers=SUPABASE_HEADERS, json=batch)
        if resp.status_code not in (200, 201):
            print(f"  INSERT ERROR: {resp.status_code} — {resp.text[:200]}")
        else:
            print(f"  Inserted {len(batch)} references (batch {i // BATCH_SIZE + 1})")
        time.sleep(0.1)


# ─── Kromp dataset (human) ───

def process_kromp_dataset(base_dir: str):
    """
    Process Kromp et al. 2023 — 2,344 human blastocyst images.

    Actual structure:
      base_dir/
        Images/                         — 2344 PNG images
        Gardner_train_silver.csv        — semicolon-delimited: Image;EXP_silver;ICM_silver;TE_silver
        Gardner_test_gold_onlyGardnerScores.csv  — semicolon-delimited: Image;EXP_gold;ICM_gold;TE_gold;
    """
    base = Path(base_dir)
    img_dir = base / "Images"

    if not img_dir.exists():
        print(f"SKIP Kromp: Images/ folder not found in {base_dir}")
        return

    print(f"\n{'='*60}")
    print(f"Processing Kromp dataset: {base_dir}")
    print(f"{'='*60}")

    # Parse both silver (train) and gold (test) annotations
    entries = []
    seen_images = set()

    csv_files = [
        ("Gardner_train_silver.csv", "silver"),
        ("Gardner_test_gold_onlyGardnerScores.csv", "gold"),
    ]

    for csv_name, label in csv_files:
        csv_path = base / csv_name
        if not csv_path.exists():
            print(f"  Warning: {csv_name} not found, skipping")
            continue

        with open(csv_path, "r", encoding="utf-8-sig") as f:
            content = f.read()

        count = 0
        for line in content.strip().split("\n")[1:]:  # skip header
            parts = line.strip().rstrip(";").split(";")
            if len(parts) < 4:
                continue

            image_name = parts[0].strip()
            exp_str = parts[1].strip()
            icm_str = parts[2].strip()
            te_str = parts[3].strip()

            if image_name in seen_images:
                continue
            seen_images.add(image_name)

            # Map numeric ICM/TE to Gardner letters
            icm_letter = ICM_NUM_TO_LETTER.get(icm_str)
            te_letter = TE_NUM_TO_LETTER.get(te_str)

            if icm_letter and te_letter:
                passagene_class = GARDNER_TO_PASSAGENE.get((icm_letter, te_letter))
            else:
                passagene_class = None

            if not passagene_class:
                # ICM=0 or TE=0 means not determinable
                # Low expansion (<=2) → classify as Morula
                try:
                    exp_num = int(exp_str)
                except ValueError:
                    continue
                if exp_num <= 2:
                    passagene_class = "Mo"
                else:
                    continue  # Skip: expanded but no ICM/TE grade

            entries.append({
                "image_name": image_name,
                "classification": passagene_class,
            })
            count += 1

        print(f"  {label}: {count} entries from {csv_name}")

    print(f"Total: {len(entries)} annotated images")

    # Class distribution
    dist = {}
    for e in entries:
        dist[e["classification"]] = dist.get(e["classification"], 0) + 1
    print(f"  Distribution: {dist}")

    # Process in parallel
    refs = []
    processed = 0
    errors = 0

    def process_entry(entry):
        img_path = img_dir / entry["image_name"]
        if not img_path.exists():
            return None

        result = get_embedding(str(img_path))
        if not result or "embedding" not in result:
            return None

        return {
            "lab_id": LAB_ID,
            "classification": entry["classification"],
            "embedding": result["embedding"],
            "species": "human",
            "source": "dataset_kromp",
        }

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(process_entry, e): e for e in entries}
        for future in as_completed(futures):
            processed += 1
            result = future.result()
            if result:
                refs.append(result)
            else:
                errors += 1

            if processed % 100 == 0:
                print(f"  Processed {processed}/{len(entries)} ({errors} errors, {len(refs)} ok)")

    print(f"Kromp complete: {len(refs)} embeddings generated ({errors} errors)")

    if refs:
        insert_references(refs)
        print(f"Kromp: {len(refs)} references inserted into atlas")


# ─── Rocha dataset (bovine) ───

def process_rocha_dataset(base_dir: str):
    """
    Process Rocha et al. 2017 — 482 bovine blastocyst images.

    Actual structure:
      base_dir/
        images/Blastocyst images/  — 482 JPG images (blq1.jpg .. blq482.jpg)
        annotations.xls            — XLS with header at row 0, data from row 2
                                     Column 0 = Figure Name (blq1, blq2, ...)
                                     Last column (42) = Modal value (1/2/3)
    """
    base = Path(base_dir)

    # Find annotation file
    grade_file = None
    for name in ["annotations.xls", "annotations.xlsx", "grades.xlsx", "grades.csv"]:
        candidate = base / name
        if candidate.exists():
            grade_file = candidate
            break

    if not grade_file:
        print(f"SKIP Rocha: annotations file not found in {base_dir}")
        return

    # Find image directory (may be nested)
    img_dir = base / "images" / "Blastocyst images"
    if not img_dir.exists():
        img_dir = base / "images"
    if not img_dir.exists():
        img_dir = base
    print(f"\n{'='*60}")
    print(f"Processing Rocha dataset: {base_dir}")
    print(f"Image dir: {img_dir}")
    print(f"{'='*60}")

    # Parse annotations
    entries = []
    try:
        import pandas as pd
        df = pd.read_excel(grade_file, header=None)

        # Row 0 has column names, row 1 is blank, data starts row 2
        # Col 0 = Figure Name, last col = Modal value
        for idx in range(2, len(df)):
            image_id = df.iloc[idx, 0]  # Figure Name: blq1, blq2, ...
            modal_value = df.iloc[idx, df.shape[1] - 1]  # Last column: Modal value

            if pd.isna(image_id) or pd.isna(modal_value):
                continue

            image_id = str(image_id).strip()
            try:
                grade_int = int(float(modal_value))
            except (ValueError, TypeError):
                continue

            passagene_class = IETS_TO_PASSAGENE.get(grade_int)
            if passagene_class:
                entries.append({"image_id": image_id, "classification": passagene_class})

    except ImportError:
        print("ERROR: pandas/xlrd required — pip install pandas xlrd")
        return

    print(f"Found {len(entries)} annotated images")

    # Class distribution
    dist = {}
    for e in entries:
        dist[e["classification"]] = dist.get(e["classification"], 0) + 1
    print(f"  Distribution: {dist}")

    # Process
    refs = []
    processed = 0
    errors = 0

    def process_entry(entry):
        image_id = entry["image_id"]
        # Try with .jpg extension
        for ext in [".jpg", ".jpeg", ".png", ".tif"]:
            img_path = img_dir / f"{image_id}{ext}"
            if img_path.exists():
                break
        else:
            return None

        result = get_embedding(str(img_path))
        if not result or "embedding" not in result:
            return None

        return {
            "lab_id": LAB_ID,
            "classification": entry["classification"],
            "embedding": result["embedding"],
            "species": "bovine_rocha",
            "source": "dataset_rocha",
        }

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(process_entry, e): e for e in entries}
        for future in as_completed(futures):
            processed += 1
            result = future.result()
            if result:
                refs.append(result)
            else:
                errors += 1

            if processed % 50 == 0:
                print(f"  Processed {processed}/{len(entries)} ({errors} errors, {len(refs)} ok)")

    print(f"Rocha complete: {len(refs)} embeddings generated ({errors} errors)")

    if refs:
        insert_references(refs)
        print(f"Rocha: {len(refs)} references inserted into atlas")


# ─── Verification ───

def verify_atlas():
    """Count references by species in the atlas."""
    count_url = f"{SUPABASE_URL}/rest/v1/embryo_references?select=species"
    headers = {**SUPABASE_HEADERS, "Prefer": "count=exact"}

    print(f"\n{'='*60}")
    print("Atlas verification")
    print(f"{'='*60}")

    for species in ["human", "bovine_rocha", "bovine_real"]:
        resp = requests.get(
            f"{count_url}&species=eq.{species}",
            headers=headers,
        )
        count = resp.headers.get("content-range", "*/0").split("/")[-1]
        print(f"  {species}: {count} references")

    resp = requests.get(count_url, headers=headers)
    total = resp.headers.get("content-range", "*/0").split("/")[-1]
    print(f"  TOTAL: {total} references")


# ─── Main ───

if __name__ == "__main__":
    print("EmbryoScore v2 — Atlas Bootstrap Cross-Species")
    print(f"DINOv2 URL: {DINOV2_URL}")
    print(f"Supabase URL: {SUPABASE_URL}")

    # Check DINOv2 health
    try:
        health = requests.get(f"{DINOV2_URL}/health", timeout=30)
        health.raise_for_status()
        print(f"DINOv2 health: OK — {health.json()}")
    except Exception as e:
        print(f"ERROR: DINOv2 not reachable — {e}")
        sys.exit(1)

    # Process datasets
    process_kromp_dataset("./datasets/kromp")
    process_rocha_dataset("./datasets/rocha")

    # Verify
    verify_atlas()

    print("\nAtlas bootstrap complete!")
    print("Next step: run scripts/train_classifier.py to train the MLP classifier")
