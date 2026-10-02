"""
Trains the paddy leaf disease classifier using transfer learning on MobileNetV2.

BEFORE RUNNING:
1. Download the "Paddy Doctor" dataset from Kaggle:
   https://www.kaggle.com/datasets/vbookshelf/rice-leaf-diseases
   (or the larger "Paddy Doctor: Paddy Disease Classification" dataset)
2. Arrange images into this folder structure:

   dataset/
     train/
       bacterial_leaf_blight/
       brown_spot/
       healthy/
       leaf_blast/
       sheath_rot/
       tungro/
     val/
       bacterial_leaf_blight/
       brown_spot/
       healthy/
       leaf_blast/
       sheath_rot/
       tungro/

3. Run: python train_model.py

This uses MobileNetV2 (lightweight, CPU-friendly) so it can train in a
reasonable time without a GPU - suitable for a 4-day hackathon timeline.
If you have Colab/GPU access, increase EPOCHS and unfreeze more base layers
for better accuracy.
"""

import tensorflow as tf
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.layers import Dense, GlobalAveragePooling2D, Dropout
from tensorflow.keras.models import Model
from tensorflow.keras.preprocessing.image import ImageDataGenerator

IMG_SIZE = (224, 224)
BATCH_SIZE = 16
EPOCHS = 12
DATASET_DIR = "dataset"
NUM_CLASSES = 6  # matches class_labels.json

# ---- Data loaders with light augmentation ----
train_datagen = ImageDataGenerator(
    rescale=1.0 / 255,
    rotation_range=20,
    width_shift_range=0.1,
    height_shift_range=0.1,
    zoom_range=0.15,
    horizontal_flip=True,
)
val_datagen = ImageDataGenerator(rescale=1.0 / 255)

train_gen = train_datagen.flow_from_directory(
    f"{DATASET_DIR}/train", target_size=IMG_SIZE, batch_size=BATCH_SIZE, class_mode="categorical"
)
val_gen = val_datagen.flow_from_directory(
    f"{DATASET_DIR}/val", target_size=IMG_SIZE, batch_size=BATCH_SIZE, class_mode="categorical"
)

print("Class indices (verify this matches class_labels.json order):", train_gen.class_indices)

# ---- Build model: MobileNetV2 base + custom classification head ----
base_model = MobileNetV2(input_shape=(224, 224, 3), include_top=False, weights="imagenet")
base_model.trainable = False  # freeze base for fast CPU training

x = GlobalAveragePooling2D()(base_model.output)
x = Dense(128, activation="relu")(x)
x = Dropout(0.3)(x)
output = Dense(NUM_CLASSES, activation="softmax")(x)

model = Model(inputs=base_model.input, outputs=output)
model.compile(optimizer="adam", loss="categorical_crossentropy", metrics=["accuracy"])
model.summary()

# ---- Train ----
history = model.fit(train_gen, validation_data=val_gen, epochs=EPOCHS)

# ---- Save ----
model.save("model/paddy_disease_model.h5")
print("Model saved to model/paddy_disease_model.h5")
print("Final validation accuracy:", history.history["val_accuracy"][-1])
