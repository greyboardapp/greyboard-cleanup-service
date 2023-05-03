/**
 * Welcome to Cloudflare Workers! This is your first scheduled worker.
 *
 * - Run `wrangler dev --local` in your terminal to start a development server
 * - Run `curl "http://localhost:8787/cdn-cgi/mf/scheduled"` to trigger the scheduled event
 * - Go back to the console to see what your worker has logged
 * - Update the Cron trigger in wrangler.toml (see https://developers.cloudflare.com/workers/wrangler/configuration/#triggers)
 * - Run `wrangler publish --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/runtime-apis/scheduled-event/
 */

export interface Env {
	db: D1Database;
	boards : R2Bucket;
}

export interface Board {
	id : string;
    isPermanent : boolean;
    modifiedAt : number;
}

export default {
	async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
		try {
			const boards = await env.db.exec<Board>("SELECT * FROM boards WHERE modifiedAt <= date('now', '-7 day') AND isPermanent = FALSE");
			if (!boards || !boards.success || !boards.results) {
				console.error("Error while reading database:", boards.error);
				return;
			}

			const ids = boards.results.map((board) => board.id);

			console.log("Deleting boards:", ids);

			const result = await env.db.exec(`DELETE FROM boards WHERE id IN (${boards.results.map((board) => `'${board.id}'`).join(",")})`);
			if (!result || !result.success) {
				console.error("Error while deleting boards from database:", result.error);
				return;
			}

			console.log("Deleting boards contents:", ids);
			await env.boards.delete(ids);

			console.log("Successfully deleted boards");
		} catch (e) {
			console.error(e);
		}
	},
};
