// Local fallback declarations for @types/multer's `Express.Multer.File`.
// The package is installed but TypeScript's narrower include after the build
// tsconfig got rootDir-pinned can fail to pick up the ambient global module
// augmentation. Re-declare the minimal surface we use here.

declare global {
  namespace Express {
    namespace Multer {
      interface File {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        buffer: Buffer;
        destination?: string;
        filename?: string;
        path?: string;
      }
    }
  }
}

export {};
