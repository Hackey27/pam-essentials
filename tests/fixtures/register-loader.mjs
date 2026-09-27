import { register } from "node:module";

register(new URL("./route-loader.mjs", import.meta.url));

