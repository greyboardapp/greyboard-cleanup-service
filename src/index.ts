interface Env {
    db : D1Database;
    boards : R2Bucket;
}

interface Board {
    id : string;
    isPermanent : boolean;
    modifiedAt : number;
}

async function cleanUp(env : Env) : Promise<void> {
    const boards = await env.db.prepare("SELECT * FROM boards WHERE (DATETIME(modifiedAt, 'unixepoch') <= date('now', '-7 day') AND isPermanent = FALSE) OR isDeleted = TRUE").all<Board>();
    console.log(boards);
    if (!boards || !boards.success || !boards.results) {
        console.error("Error while reading database:", boards.error);
        throw new Error(`Error while reading database: ${boards.error}`);
    }

    if (boards.results.length === 0) {
        console.log("Nothing to delete");
        return;
    }

    const ids = boards.results.map((board) => board.id);

    console.log("Deleting boards:", ids);

    let result = await env.db.prepare(`DELETE FROM boards WHERE id IN (${boards.results.map((board) => `'${board.id}'`).join(",")})`).run();
    if (!result || !result.success || !result.results) {
        console.error("Error while deleting boards from database:", result.error);
        throw new Error(`Error while deleting boards from database: ${result.error}`);
    }

    result = await env.db.prepare(`DELETE FROM access WHERE board IN (${boards.results.map((board) => `'${board.id}'`).join(",")})`).run();
    if (!result || !result.success || !result.results) {
        console.error("Error while deleting board accesses from database:", result.error);
        throw new Error(`Error while deleting board accesses from database: ${result.error}`);
    }

    console.log("Deleting boards contents:", ids);
    await env.boards.delete(ids);

    console.log("Successfully deleted boards");
}

export default {
    async scheduled(controller : ScheduledController, env : Env, ctx : ExecutionContext) : Promise<void> {
        return cleanUp(env);
    },
    async fetch(request : Request, env : Env) : Promise<Response> {
        try {
            await cleanUp(env);
            return new Response("ok", { status: 200 });
        } catch (e) {
            console.error(e as string);
            return new Response(e as string, { status: 500 });
        }
    },
};
