export class MatrixProject
{
    constructor(info)
    {
        this.id = info.id;
        this.title = info.title;
        this.description = info.description;
    }

    async start(_host)
    {
        throw new Error(this.id + " has no start()");
    }
}
