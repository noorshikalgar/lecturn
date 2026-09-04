import "express";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        role: "admin" | "user";
        firstName: string | null;
        lastName: string | null;
        email: string | null;
        avatarId: number | null;
        createdAt: string;
      };
    }
  }
}
