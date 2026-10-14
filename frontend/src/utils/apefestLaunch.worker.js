/* eslint-disable no-restricted-globals */
import { decodePng, renderSceneRGB, pilAlphaComposite } from './apefestScene';

self.onmessage = async ({ data }) => {
    const { id, src, W, H, opts, layers } = data;
    try {
        const ape = await decodePng(src);
        const out = renderSceneRGB(ape, W, H, opts);
        for (const buf of layers || []) {
            const layer = await decodePng(buf);
            pilAlphaComposite(out, layer.data);
        }
        self.postMessage({ id, out }, [out.buffer]);
    } catch (e) {
        self.postMessage({ id, error: String(e && e.message ? e.message : e) });
    }
};
