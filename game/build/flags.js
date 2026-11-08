// Runs first in the single-file build: provide the WebRTC library and mark standalone mode.
import { Peer } from 'peerjs';
window.__PEER = Peer;
window.__STANDALONE = true;
