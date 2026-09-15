import { writeFile } from "node:fs/promises";

const targets = await fetch("http://127.0.0.1:53980/json/list").then((response) => response.json());
const target = targets.find((item) => item.type === "page" && item.url.startsWith("http://localhost:4173/"));

if (!target) throw new Error("Local form preview tab was not found.");

const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
let nextId = 1;

socket.addEventListener("message", (event) => {
  const payload = JSON.parse(event.data);
  if (!payload.id || !pending.has(payload.id)) return;
  const { resolve, reject } = pending.get(payload.id);
  pending.delete(payload.id);
  if (payload.error) reject(new Error(payload.error.message));
  else resolve(payload.result);
});

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});

await send("Emulation.setEmulatedMedia", { media: "print" });
const { data } = await send("Page.printToPDF", {
  landscape: true,
  printBackground: true,
  preferCSSPageSize: true,
  displayHeaderFooter: false,
  marginTop: 0,
  marginBottom: 0,
  marginLeft: 0,
  marginRight: 0,
  paperWidth: 11.692913,
  paperHeight: 8.267717,
});

await writeFile("qa-print-a4.pdf", Buffer.from(data, "base64"));
socket.close();
