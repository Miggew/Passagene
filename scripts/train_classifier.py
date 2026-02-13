#!/usr/bin/env python3
"""
train_classifier.py — Treinar MLP com embeddings do atlas cross-species.

Busca embeddings + classificações do Supabase, treina MLP (768→256→7),
salva pesos em embryo_classifier.pth.

Requer:
  - Atlas populado (executar bootstrap_atlas.py primeiro)
  - PyTorch instalado

Env vars:
  SUPABASE_URL          — URL do projeto Supabase
  SUPABASE_SERVICE_KEY  — Service role key

Usage:
  pip install torch requests numpy
  python scripts/train_classifier.py
"""

import os
import sys
import json
import requests
import numpy as np

try:
    import torch
    import torch.nn as nn
    from torch.utils.data import TensorDataset, DataLoader
except ImportError:
    print("ERROR: PyTorch required — pip install torch")
    sys.exit(1)

# ─── Config ───

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_KEY")
    sys.exit(1)

SUPABASE_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

CLASSES = ["BE", "BN", "BX", "BL", "BI", "Mo", "Dg"]
CLASS_TO_IDX = {c: i for i, c in enumerate(CLASSES)}

EMBEDDING_DIM = 768
HIDDEN_DIM = 256
NUM_CLASSES = len(CLASSES)

EPOCHS = 50
BATCH_SIZE = 64
LEARNING_RATE = 1e-3
WEIGHT_DECAY = 1e-4
TRAIN_SPLIT = 0.8
OUTPUT_PATH = "embryo_classifier.pth"


# ─── Model ───

class EmbryoClassifier(nn.Module):
    """MLP classifier trained on cross-species DINOv2 embeddings."""

    def __init__(self, input_dim=EMBEDDING_DIM, hidden_dim=HIDDEN_DIM, num_classes=NUM_CLASSES):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(hidden_dim, num_classes),
        )
        self.classes = CLASSES

    def forward(self, x):
        return self.net(x)

    def predict(self, embedding_tensor):
        with torch.no_grad():
            logits = self.forward(embedding_tensor)
            probs = torch.softmax(logits, dim=-1)
            top_prob, top_idx = probs.max(dim=-1)
            return {
                "classification": self.classes[top_idx.item()],
                "confidence": round(top_prob.item() * 100),
                "probabilities": {
                    cls: round(p.item() * 100)
                    for cls, p in zip(self.classes, probs[0])
                },
            }


# ─── Data loading ───

def fetch_atlas_data() -> tuple[np.ndarray, np.ndarray]:
    """Fetch all embeddings + classifications from embryo_references."""
    print("Fetching atlas data from Supabase...")

    embeddings = []
    labels = []
    offset = 0
    page_size = 1000

    while True:
        url = (
            f"{SUPABASE_URL}/rest/v1/embryo_references"
            f"?select=embedding,classification"
            f"&embedding=not.is.null"
            f"&order=id"
            f"&offset={offset}&limit={page_size}"
        )
        resp = requests.get(url, headers=SUPABASE_HEADERS)
        resp.raise_for_status()
        data = resp.json()

        if not data:
            break

        for row in data:
            cls = row.get("classification")
            emb = row.get("embedding")
            if cls not in CLASS_TO_IDX or not emb:
                continue
            # Supabase may return embedding as JSON string or list
            if isinstance(emb, str):
                emb = json.loads(emb)
            embeddings.append(emb)
            labels.append(CLASS_TO_IDX[cls])

        offset += len(data)
        print(f"  Fetched {offset} rows...")

        if len(data) < page_size:
            break

    print(f"Total: {len(embeddings)} samples with valid embeddings")

    X = np.array(embeddings, dtype=np.float32)
    y = np.array(labels, dtype=np.int64)
    return X, y


def stratified_split(y: np.ndarray, train_ratio: float = TRAIN_SPLIT):
    """Stratified train/test split."""
    rng = np.random.default_rng(42)
    train_idx = []
    test_idx = []

    for cls_idx in range(NUM_CLASSES):
        cls_indices = np.where(y == cls_idx)[0]
        rng.shuffle(cls_indices)
        split = int(len(cls_indices) * train_ratio)
        train_idx.extend(cls_indices[:split])
        test_idx.extend(cls_indices[split:])

    return np.array(train_idx), np.array(test_idx)


# ─── Training ───

def train():
    X, y = fetch_atlas_data()

    if len(X) < 50:
        print(f"ERROR: Only {len(X)} samples — need at least 50 for training")
        sys.exit(1)

    # Class distribution
    print("\nClass distribution:")
    for cls_name, cls_idx in CLASS_TO_IDX.items():
        count = np.sum(y == cls_idx)
        print(f"  {cls_name}: {count} ({count / len(y) * 100:.1f}%)")

    # Split
    train_idx, test_idx = stratified_split(y)
    X_train, y_train = X[train_idx], y[train_idx]
    X_test, y_test = X[test_idx], y[test_idx]
    print(f"\nTrain: {len(X_train)}, Test: {len(X_test)}")

    # Class weights (handle imbalanced classes)
    class_counts = np.bincount(y_train, minlength=NUM_CLASSES).astype(np.float32)
    class_counts = np.maximum(class_counts, 1)  # Avoid div by zero
    class_weights = 1.0 / class_counts
    class_weights = class_weights / class_weights.sum() * NUM_CLASSES
    class_weights_tensor = torch.tensor(class_weights)
    print(f"Class weights: {dict(zip(CLASSES, [f'{w:.2f}' for w in class_weights]))}")

    # DataLoaders
    train_ds = TensorDataset(torch.tensor(X_train), torch.tensor(y_train))
    test_ds = TensorDataset(torch.tensor(X_test), torch.tensor(y_test))
    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True)
    test_loader = DataLoader(test_ds, batch_size=BATCH_SIZE)

    # Model
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")

    model = EmbryoClassifier().to(device)
    criterion = nn.CrossEntropyLoss(weight=class_weights_tensor.to(device))
    optimizer = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE, weight_decay=WEIGHT_DECAY)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS)

    # Train
    print(f"\nTraining for {EPOCHS} epochs...")
    best_acc = 0.0
    best_state = None

    for epoch in range(1, EPOCHS + 1):
        model.train()
        total_loss = 0
        correct = 0
        total = 0

        for batch_X, batch_y in train_loader:
            batch_X, batch_y = batch_X.to(device), batch_y.to(device)
            optimizer.zero_grad()
            logits = model(batch_X)
            loss = criterion(logits, batch_y)
            loss.backward()
            optimizer.step()

            total_loss += loss.item() * len(batch_X)
            preds = logits.argmax(dim=-1)
            correct += (preds == batch_y).sum().item()
            total += len(batch_X)

        scheduler.step()
        train_loss = total_loss / total
        train_acc = correct / total * 100

        # Evaluate
        model.eval()
        test_correct = 0
        test_total = 0
        with torch.no_grad():
            for batch_X, batch_y in test_loader:
                batch_X, batch_y = batch_X.to(device), batch_y.to(device)
                logits = model(batch_X)
                preds = logits.argmax(dim=-1)
                test_correct += (preds == batch_y).sum().item()
                test_total += len(batch_X)

        test_acc = test_correct / test_total * 100 if test_total > 0 else 0

        if epoch % 5 == 0 or epoch == 1:
            print(f"  Epoch {epoch:3d} — Loss: {train_loss:.4f}, Train: {train_acc:.1f}%, Test: {test_acc:.1f}%")

        if test_acc > best_acc:
            best_acc = test_acc
            best_state = model.state_dict().copy()

    # Save best model
    if best_state:
        model.load_state_dict(best_state)

    torch.save(model.state_dict(), OUTPUT_PATH)
    print(f"\nModel saved to {OUTPUT_PATH}")
    print(f"Best test accuracy: {best_acc:.1f}%")

    # Per-class accuracy
    print("\nPer-class accuracy (test set):")
    model.eval()
    class_correct = np.zeros(NUM_CLASSES)
    class_total = np.zeros(NUM_CLASSES)

    with torch.no_grad():
        for batch_X, batch_y in test_loader:
            batch_X, batch_y = batch_X.to(device), batch_y.to(device)
            preds = model(batch_X).argmax(dim=-1)
            for cls_idx in range(NUM_CLASSES):
                mask = batch_y == cls_idx
                class_total[cls_idx] += mask.sum().item()
                class_correct[cls_idx] += (preds[mask] == cls_idx).sum().item()

    for cls_idx, cls_name in enumerate(CLASSES):
        total = class_total[cls_idx]
        acc = class_correct[cls_idx] / total * 100 if total > 0 else 0
        print(f"  {cls_name}: {acc:.1f}% ({int(class_correct[cls_idx])}/{int(total)})")

    print(f"\nNext step: Upload {OUTPUT_PATH} to the DINOv2 Cloud Run container")


if __name__ == "__main__":
    print("EmbryoScore v2 — MLP Classifier Training")
    print(f"Supabase URL: {SUPABASE_URL}")
    train()
