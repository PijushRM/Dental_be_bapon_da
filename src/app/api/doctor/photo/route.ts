import { deleteFile, formFile, saveUpload } from "@/lib/files";
import { HttpError, handle } from "@/lib/http";
import { authedDoctor } from "@/lib/session";
import { IMAGE_MIME_TYPES } from "@/lib/validation";
import { profileOf } from "@/models/Doctor";

// multipart/form-data with a "photo" field (JPG or PNG).
export const PUT = handle(async (request: Request) => {
  const doctor = await authedDoctor(request);
  const photo = formFile(await request.formData(), "photo");
  if (!photo) throw new HttpError(400, "Add a photo first.");
  const saved = await saveUpload(photo, doctor.id, IMAGE_MIME_TYPES);
  const previous = doctor.photoFileId;
  doctor.photoFileId = saved.fileId;
  await doctor.save();
  if (previous) await deleteFile(previous);
  return Response.json({ doctor: profileOf(doctor) });
});

export const DELETE = handle(async (request: Request) => {
  const doctor = await authedDoctor(request);
  if (doctor.photoFileId) {
    await deleteFile(doctor.photoFileId);
    doctor.photoFileId = "";
    await doctor.save();
  }
  return Response.json({ doctor: profileOf(doctor) });
});
