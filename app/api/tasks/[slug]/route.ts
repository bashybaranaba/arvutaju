import { NextRequest } from "next/server";
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  await connectToDatabase();
  const { slug } = await params;
  const { imageUrl } = await req.json();

  if (!imageUrl || typeof imageUrl !== "string") {
    return Response.json({ error: "imageUrl required" }, { status: 400 });
  }

  const task = await Task.findOneAndUpdate(
    { slug },
    [
      {
        $set: {
          imageUrl,
          workbookAssets: {
            $concatArrays: [
              {
                $filter: {
                  input: { $ifNull: ["$workbookAssets", []] },
                  as: "asset",
                  cond: { $ne: ["$$asset.kind", "task"] },
                },
              },
              [
                {
                  kind: "task",
                  url: imageUrl,
                  page: { $ifNull: ["$sourcePageNumber", "$pageRef"] },
                  label: "$titleEt",
                  sourcePdfName: "$sourcePdfName",
                  pdfPage: "$sourcePdfPageNumber",
                },
              ],
            ],
          },
        },
      },
    ],
    { returnDocument: "after" }
  ).lean();

  if (!task) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  return Response.json({ ok: true, imageUrl });
}
