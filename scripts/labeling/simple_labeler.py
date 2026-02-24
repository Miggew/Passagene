import tkinter as tk
from tkinter import messagebox
from PIL import Image, ImageTk
import os
import glob

# --- Configuration ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
IMAGES_DIR = os.path.join(PROJECT_ROOT, "datasets", "images")
LABELS_DIR = os.path.join(PROJECT_ROOT, "datasets", "labels")
CLASSES_FILE = os.path.join(PROJECT_ROOT, "datasets", "classes.txt")

CLASS_NAMES = ["embriao"]
COLORS = ["red", "green", "blue"]

class SimpleLabeler:
    def __init__(self, root):
        self.root = root
        self.root.title("Passagene Simple Labeler (YOLO)")
        self.root.geometry("1200x800")

        # Data
        self.image_files = sorted(glob.glob(os.path.join(IMAGES_DIR, "*.jpg")) + 
                                  glob.glob(os.path.join(IMAGES_DIR, "*.png")) +
                                  glob.glob(os.path.join(IMAGES_DIR, "*.jpeg")))
        self.current_index = 0
        self.rectangles = []  # [(rect_id, x1, y1, x2, y2, class_idx)]
        self.start_x = None
        self.start_y = None
        self.current_rect = None
        self.tk_image = None
        self.image_width = 0
        self.image_width = 0
        self.image_height = 0
        self.scale = 1.0  # Initialize scale default
        
        # UI
        self.canvas_frame = tk.Frame(root)
        self.canvas_frame.pack(fill=tk.BOTH, expand=True)
        
        self.canvas = tk.Canvas(self.canvas_frame, cursor="cross", bg="grey")
        self.canvas.pack(fill=tk.BOTH, expand=True)
        
        self.canvas.bind("<ButtonPress-1>", self.on_button_press)
        self.canvas.bind("<B1-Motion>", self.on_move_press)
        self.canvas.bind("<ButtonRelease-1>", self.on_button_release)
        self.root.bind("<Delete>", self.delete_selected)
        self.root.bind("<Right>", lambda e: self.next_image())
        self.root.bind("<Left>", lambda e: self.prev_image())
        self.root.bind("<d>", self.delete_selected)

        # Controls
        self.controls_frame = tk.Frame(root, height=50)
        self.controls_frame.pack(fill=tk.X, side=tk.BOTTOM)
        
        tk.Button(self.controls_frame, text="<< Anterior (Left)", command=self.prev_image).pack(side=tk.LEFT, padx=10)
        self.lbl_status = tk.Label(self.controls_frame, text="0/0")
        self.lbl_status.pack(side=tk.LEFT, padx=10)
        tk.Button(self.controls_frame, text="Próxima (Right) >>", command=self.next_image).pack(side=tk.LEFT, padx=10)
        tk.Button(self.controls_frame, text="Salvar Agora", command=self.save_labels).pack(side=tk.LEFT, padx=20)
        tk.Label(self.controls_frame, text="[Arraste para criar caixa. DEL para apagar ultima caixa]").pack(side=tk.RIGHT, padx=10)

        # Init
        self.ensure_directories()
        if not self.image_files:
            messagebox.showerror("Erro", f"Nenhuma imagem encontrada em:\n{IMAGES_DIR}")
        else:
            self.load_image(0)

    def ensure_directories(self):
        if not os.path.exists(LABELS_DIR):
            os.makedirs(LABELS_DIR)
        with open(CLASSES_FILE, "w") as f:
            for c in CLASS_NAMES:
                f.write(c + "\n")

    def load_image(self, index):
        if not self.image_files: return
        
        # Save previous if needed (simplified: auto-save on navigation)
        self.save_labels()
        
        self.current_index = index
        self.lbl_status.config(text=f"Imagem {index+1} de {len(self.image_files)}: {os.path.basename(self.image_files[index])}")
        
        # Clear canvas
        self.canvas.delete("all")
        self.rectangles = []

        # Load Img
        img_path = self.image_files[index]
        try:
            pil_image = Image.open(img_path)
            self.image_width, self.image_height = pil_image.size
            
            # Resize slightly to fit window if too huge (optional, sticking to 1:1 for simplicity and accuracy for now, assume scroll or large monitor. 
            # Actually, let's scale to fit if needed, but managing coordinates is tricky. 
            # Let's keep 1:1 and add scrollbars if I had time, but for now strict 1:1 is safest for coordinates.)
            # Wait, 1200x800 window. Microscopy images might be 1920x1080.
            # Let's scale DOWN if larger than canvas, and track scale factor.
            
            cw = self.root.winfo_width() or 1200
            ch = (self.root.winfo_height() or 800) - 50
            
            self.scale = 1.0
            if self.image_width > cw or self.image_height > ch:
                ratio = min(cw / self.image_width, ch / self.image_height)
                new_w = int(self.image_width * ratio)
                new_h = int(self.image_height * ratio)
                pil_image = pil_image.resize((new_w, new_h), Image.Resampling.LANCZOS)
                self.scale = ratio
            
            self.tk_image = ImageTk.PhotoImage(pil_image)
            self.canvas.create_image(0, 0, image=self.tk_image, anchor=tk.NW)
            
            # Load existing labels
            self.load_labels(img_path)
            
        except Exception as e:
            print(f"Error loading image: {e}")

    def load_labels(self, img_path):
        basename = os.path.splitext(os.path.basename(img_path))[0]
        txt_path = os.path.join(LABELS_DIR, basename + ".txt")
        if os.path.exists(txt_path):
            with open(txt_path, "r") as f:
                for line in f:
                    parts = line.strip().split()
                    if len(parts) >= 5:
                        cls = int(parts[0])
                        cx = float(parts[1])
                        cy = float(parts[2])
                        w = float(parts[3])
                        h = float(parts[4])
                        
                        # Convert YOLO to Pixels
                        img_w, img_h = self.image_width, self.image_height # Original dimensions
                        
                        pixel_w = w * img_w
                        pixel_h = h * img_h
                        pixel_cx = cx * img_w
                        pixel_cy = cy * img_h
                        
                        x1 = pixel_cx - pixel_w/2
                        y1 = pixel_cy - pixel_h/2
                        x2 = pixel_cx + pixel_w/2
                        y2 = pixel_cy + pixel_h/2
                        
                        # Apply UI Scale
                        x1 *= self.scale
                        y1 *= self.scale
                        x2 *= self.scale
                        y2 *= self.scale
                        
                        rect_id = self.canvas.create_rectangle(x1, y1, x2, y2, outline=COLORS[cls % len(COLORS)], width=2)
                        self.rectangles.append((rect_id, x1, y1, x2, y2, cls))


    def save_labels(self):
        if not self.image_files: return
        img_path = self.image_files[self.current_index]
        basename = os.path.splitext(os.path.basename(img_path))[0]
        txt_path = os.path.join(LABELS_DIR, basename + ".txt")
        
        if not self.rectangles:
            if os.path.exists(txt_path):
                os.remove(txt_path)
            return
            
        with open(txt_path, "w") as f:
            for rect_data in self.rectangles:
                # rect_data: (id, x1, y1, x2, y2, cls)
                # Coords are SCALED pixels. Need to convert to Unscaled Normalized
                
                sx1, sy1, sx2, sy2 = rect_data[1], rect_data[2], rect_data[3], rect_data[4]
                
                # Unscale
                x1 = sx1 / self.scale
                y1 = sy1 / self.scale
                x2 = sx2 / self.scale
                y2 = sy2 / self.scale
                
                # Normalize
                img_w, img_h = self.image_width, self.image_height
                
                cx = ((x1 + x2) / 2) / img_w
                cy = ((y1 + y2) / 2) / img_h
                w = (abs(x2 - x1)) / img_w
                h = (abs(y2 - y1)) / img_h
                
                # Clamp
                cx = min(max(cx, 0), 1)
                cy = min(max(cy, 0), 1)
                w = min(max(w, 0), 1)
                h = min(max(h, 0), 1)
                
                f.write(f"{rect_data[5]} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}\n")
        print(f"Saved {len(self.rectangles)} labels for {basename}")

    def on_button_press(self, event):
        self.start_x = self.canvas.canvasx(event.x)
        self.start_y = self.canvas.canvasy(event.y)
        self.current_rect = self.canvas.create_rectangle(self.start_x, self.start_y, self.start_x, self.start_y, outline="red", width=2)

    def on_move_press(self, event):
        cur_x = self.canvas.canvasx(event.x)
        cur_y = self.canvas.canvasy(event.y)
        self.canvas.coords(self.current_rect, self.start_x, self.start_y, cur_x, cur_y)

    def on_button_release(self, event):
        end_x = self.canvas.canvasx(event.x)
        end_y = self.canvas.canvasy(event.y)
        
        # Don't create tiny boxes
        if abs(end_x - self.start_x) < 5 or abs(end_y - self.start_y) < 5:
            self.canvas.delete(self.current_rect)
            return

        # Normalize coords (x1 is top left)
        x1, x2 = sorted([self.start_x, end_x])
        y1, y2 = sorted([self.start_y, end_y])
        
        self.rectangles.append((self.current_rect, x1, y1, x2, y2, 0)) # Default class 0 (embryo)
        self.current_rect = None

    def delete_selected(self, event=None):
        if self.rectangles:
            # Delete last created
            last = self.rectangles.pop()
            self.canvas.delete(last[0])

    def next_image(self):
        if self.current_index < len(self.image_files) - 1:
            self.load_image(self.current_index + 1)
        else:
            self.save_labels()
            messagebox.showinfo("Fim", "Você chegou na última imagem!")

    def prev_image(self):
        if self.current_index > 0:
            self.load_image(self.current_index - 1)

if __name__ == "__main__":
    root = tk.Tk()
    app = SimpleLabeler(root)
    root.mainloop()
