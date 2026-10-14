/* eslint-disable no-restricted-globals */
import { runJob } from './apefestJob';

self.onmessage = async ({ data }) => {
    try {
        const out = await runJob(data);
        self.postMessage({ id: data.id, out }, [out.buffer]);
    } catch (e) {
        self.postMessage({ id: data.id, error: String(e && e.message ? e.message : e) });
    }
};
