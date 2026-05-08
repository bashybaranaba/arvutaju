import { connectToDatabase } from "@/lib/mongoose";
import Task from "@/lib/models/Task";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  await connectToDatabase();
  const { slug } = await params;
  const task = await Task.findOne({ slug }, { embedding: 0 }).lean();

  if (!task) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  return Response.json({ task });
}
