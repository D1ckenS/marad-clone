import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env before NestJS modules initialise so DATABASE_URL + JWT_SECRET are
// available when PrismaService and JwtModule read process.env.
config({ path: resolve(__dirname, '../.env') });
