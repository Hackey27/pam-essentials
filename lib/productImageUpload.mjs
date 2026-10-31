export async function prepareProductImage(file, kind) {
  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = source;
    await image.decode();
    const limit = kind === "card-preview" ? 1600 : 2000;
    const scale = Math.min(1, limit / image.naturalWidth, limit / image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser could not prepare the photo. Try another browser.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const compressed = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
    if (!compressed) throw new Error("The photo could not be prepared. Choose another image.");
    return scale === 1 && compressed.size >= file.size ? file : compressed;
  } finally { URL.revokeObjectURL(source); }
}

export function uploadProductImage({ image, token, productId, path, onProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/images");
    for (const [key, value] of Object.entries({ authorization: `Bearer ${token}`, "content-type": image.type, "x-product-id": productId, "x-image-path": path })) xhr.setRequestHeader(key, value);
    xhr.timeout = 120000;
    xhr.upload.onprogress = (event) => onProgress(event.lengthComputable ? Math.round(event.loaded / event.total * 100) : null);
    xhr.onload = () => {
      let response;
      try { response = JSON.parse(xhr.responseText); }
      catch { reject(new Error("The upload server returned an unreadable response. Please retry.")); return; }
      if (xhr.status >= 200 && xhr.status < 300) resolve(response);
      else reject(new Error(response.error || `Upload failed (${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error("The upload connection failed. Check the connection and try again."));
    xhr.ontimeout = () => reject(new Error("Upload timed out. Check the connection and try again."));
    xhr.send(image);
  });
}
