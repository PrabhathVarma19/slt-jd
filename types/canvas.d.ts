declare module 'canvas' {
  export function createCanvas(width: number, height: number): HTMLCanvasElement;
  export class Image {
    src: string | Buffer;
    width: number;
    height: number;
  }
}
