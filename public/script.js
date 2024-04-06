const tableBodyEl = document.getElementById("file_rows");
window.onload = async () => {
  const response = await fetch("/api/files");
  const data = await response.json();
  data.forEach((file) => {
    const tr = document.createElement("tr");

    const td1 = document.createElement("td");
    const a = document.createElement("a");
    a.href = file.Url;
    a.textContent = file.Key;
    a.download = file.Url;
    td1.appendChild(a);
    tr.appendChild(td1);

    const td2 = document.createElement("td");
    const dateStr = new Date(file.LastModified).toLocaleString()
    td2.textContent = dateStr;
    tr.appendChild(td2);

    const td3 = document.createElement("td");
    const btn = document.createElement("button");
    btn.classList = "btn btn-danger"
    btn.textContent = "Delete";
    btn.onclick = async () => {
      await fetch("/api/delete_file", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: file.Key,
        }),
      });
      window.location.reload();
    };
    td3.appendChild(btn);
    tr.appendChild(td3);

    tableBodyEl.appendChild(tr);
  });
}

async function getBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

async function submitForm(e) {
  e.preventDefault();
  const files = document.getElementById("files");
  const { name } = files.files[0];
  const data = await getBase64(files.files[0]);
  await fetch("/api/upload_files", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      data
    }),
  });
  window.location.reload();
}
const form = document.getElementById("form");
form.addEventListener("submit", submitForm);