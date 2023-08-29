import axios from "axios";
import pdf from "pdf-parse";
import type { NextApiRequest, NextApiResponse } from "next";

// FIXME: This is a temporary solution to convert PDF to text
// This API should be moved to App Router folder (app\api\fetch\route.ts) when NextJs fix concurrent bug
// https://github.com/vercel/next.js/discussions/37424
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { url } = req.query;
    if (!url) {
      res.status(400).json({ error: "No URL provided" });
      return;
    }

    const response = await axios.get(url as string, {
      responseType: "arraybuffer",
    });

    if (!response.headers["content-type"].includes("application/pdf")) {
      res.status(400).json({ error: "URL provided is not a PDF" });
      return;
    }

    const pdfBuffer = response.data;
    const data = await pdf(pdfBuffer);
    const content = data.text;
    const size = data.text.length;

    res.status(200).json({ url, content, size, type: "application/pdf" });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
}
