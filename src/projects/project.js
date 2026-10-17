export class MatrixProject
{
    constructor(info)
    {
        this.id = info.id;
        this.title = info.title;
        this.description = info.description;
        this.repo = info.repo || "";
        this.shows = info.shows || "";
        this.thumb = info.thumb || "";
    }

    async start(_host)
    {
        throw new Error(this.id + " has no start()");
    }
}
