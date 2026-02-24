"""
Convert DINOv2-ViT-S/14 to ONNX format.

Run this LOCALLY where PyTorch is installed (not in Cloud Run):
    pip install torch torchvision onnx onnxscript
    python convert_dino_to_onnx.py

Output: dinov2_vits14.onnx (~85MB) — include in Docker build.
"""

import torch

def main():
    print("Loading DINOv2-ViT-S/14...")
    model = torch.hub.load('facebookresearch/dinov2', 'dinov2_vits14')
    model.eval()

    dummy = torch.randn(1, 3, 224, 224)

    print("Exporting to ONNX (legacy exporter)...")
    torch.onnx.export(
        model, dummy, "dinov2_vits14.onnx",
        input_names=["image"],
        output_names=["embedding"],
        dynamic_axes={"image": {0: "batch"}, "embedding": {0: "batch"}},
        opset_version=17,
        dynamo=False,  # Force legacy exporter (compatible with DINOv2)
    )

    print("Done! Output: dinov2_vits14.onnx")
    print("Copy this file to cloud-run/embryoscore-pipeline/ before deploying.")

if __name__ == "__main__":
    main()
