/**
 * `ffmpeg-static` ships no type declarations — its whole module.exports is the
 * resolved path to the platform's ffmpeg binary (or falsy if none could be resolved).
 */
declare module "ffmpeg-static" {
  const ffmpegPath: string | null;
  export default ffmpegPath;
}
