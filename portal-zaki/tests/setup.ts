// Loads .env for tools and tests invoked outside the Next.js runtime (which does not
// auto-load env for them). Integration tests read TEST_DATABASE_URL from here.
import "dotenv/config";
