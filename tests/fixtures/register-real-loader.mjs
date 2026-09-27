import { register } from "node:module";

register(new URL("./real-route-loader.mjs", import.meta.url));

