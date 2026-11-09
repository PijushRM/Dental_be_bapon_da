import { z } from "zod";
import {
  ACCEPTED_MIME_TYPES,
  DOC_TYPES,
  IMAGE_MIME_TYPES,
  MAX_FILE_BYTES,
  MAX_AGE,
  MIN_PASSWORD_LENGTH,
  changePasswordSchema,
  credentialsSchema,
  newAppointmentSchema,
  newPatientSchema,
  profilePatchSchema,
} from "@/lib/validation";

// Request schemas come from the same Zod schemas the routes validate with,
// so the docs can't drift from the real rules. (Refinements such as the phone
// format can't be expressed in JSON Schema; they're described in text instead.)
const fromZod = (schema: z.ZodType) =>
  z.toJSONSchema(schema, { io: "input", unrepresentable: "any", target: "openapi-3.0" });

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object) => ({ "application/json": { schema } });
const ok = (description: string, schema: object) => ({ description, content: json(schema) });
const err = (description: string) => ({ description, content: json(ref("Error")) });
const id = { type: "string", pattern: "^[a-f0-9]{24}$", example: "6af18f5e9f62c5cdd2ec8fb9" };
const iso = { type: "string", format: "date-time" };
const idParam = (name: string) => ({
  name: "id",
  in: "path",
  required: true,
  description: `${name} id`,
  schema: id,
});

const authErrors = {
  401: err("Missing, invalid or expired token"),
};
const MB = MAX_FILE_BYTES / (1024 * 1024);

export function buildOpenApiSpec(serverUrl: string) {
  return {
    openapi: "3.0.3",
    info: {
      title: "Dental backend API",
      version: "1.0.0",
      description: [
        "Backend for the Smile Doctor app: doctor accounts, patients, appointments and patient records.",
        "",
        "**Auth:** call `POST /api/auth/register` or `POST /api/auth/login`, then click **Authorize** and paste the `token`.",
        "Every doctor sees only their own data. Tokens last 30 days.",
        "",
        "**Errors** are JSON: `{ error, details? }`. `details` maps a field path to a message, e.g. `{ \"patient.phone\": \"Enter a valid phone number.\" }`.",
        "",
        `**Validation:** phone has 10–13 digits (\`+\`, spaces, \`()\` and \`-\` allowed); age 0–${MAX_AGE}; password at least ${MIN_PASSWORD_LENGTH} characters; email optional.`,
      ].join("\n"),
    },
    servers: [{ url: serverUrl }],
    tags: [
      { name: "Health" },
      { name: "Auth" },
      { name: "Doctor", description: "The logged-in doctor's profile" },
      { name: "Patients" },
      { name: "Appointments" },
      { name: "Records", description: "Uploads and notes on a patient's record" },
      { name: "Files" },
      { name: "Sync" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
      schemas: {
        Error: {
          type: "object",
          required: ["error"],
          properties: {
            error: { type: "string", example: "Validation failed" },
            details: {
              type: "object",
              additionalProperties: { type: "string" },
              example: { "patient.phone": "Enter a valid phone number." },
            },
          },
        },
        Credentials: fromZod(credentialsSchema),
        ChangePassword: fromZod(changePasswordSchema),
        NewPatient: fromZod(newPatientSchema),
        NewAppointment: {
          ...fromZod(newAppointmentSchema),
          description: "Send `startsAt` plus exactly one of `patientId` or `patient`.",
        },
        ProfilePatch: {
          ...fromZod(profilePatchSchema),
          description:
            "Send only the fields that change. `opens`/`closes` are minutes from midnight and `closes` must be after `opens`; `workingDays` has 7 entries, Sunday first, at least one `true`.",
        },
        Doctor: {
          type: "object",
          properties: {
            id,
            identifier: { type: "string", example: "dr@clinic.com" },
            name: { type: "string", example: "Dr. Subhas Middya" },
            qualifications: { type: "string", example: "BDS, MDS" },
            speciality: { type: "string", example: "Conservative Dentistry" },
            email: { type: "string" },
            phone: { type: "string" },
            clinicName: { type: "string", example: "Smile Dental Clinic" },
            opens: { type: "integer", example: 540, description: "Minutes from midnight" },
            closes: { type: "integer", example: 1080 },
            workingDays: {
              type: "array",
              items: { type: "boolean" },
              minItems: 7,
              maxItems: 7,
              description: "Sunday first",
            },
            photoUrl: { type: "string", example: "/api/files/6af18f60536b402a5e05e957", description: "Empty when no photo" },
            alerts: { type: "boolean" },
          },
        },
        Session: {
          type: "object",
          properties: { token: { type: "string" }, doctor: ref("Doctor") },
        },
        Patient: {
          type: "object",
          properties: {
            id,
            name: { type: "string", example: "Amit Das" },
            age: { type: "integer", example: 34 },
            phone: { type: "string", example: "+91 98300 12345" },
            email: { type: "string", example: "" },
            createdAt: iso,
          },
        },
        Appointment: {
          type: "object",
          properties: { id, patientId: id, startsAt: iso, createdAt: iso },
        },
        AppointmentWithPatient: {
          allOf: [ref("Appointment"), { type: "object", properties: { patient: ref("Patient") } }],
        },
        StoredFile: {
          type: "object",
          properties: {
            fileId: id,
            name: { type: "string", example: "Rx_AmitDas.pdf" },
            size: { type: "integer", description: "Bytes" },
            mimeType: { type: "string", enum: ACCEPTED_MIME_TYPES },
            url: { type: "string", example: "/api/files/6af18f5f536b402a5e05e953" },
          },
        },
        RecordEntry: {
          type: "object",
          properties: {
            id,
            patientId: id,
            at: iso,
            docType: { type: "string", enum: [...DOC_TYPES], nullable: true, description: "null = note only" },
            file: { allOf: [ref("StoredFile")], nullable: true },
            note: { type: "string" },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      "/api/health": {
        get: {
          tags: ["Health"],
          summary: "Check the server and database",
          security: [],
          responses: {
            200: ok("Database reachable", {
              type: "object",
              properties: { status: { example: "ok" }, db: { example: "connected" } },
            }),
            500: ok("Database unreachable", {
              type: "object",
              properties: { status: { example: "error" }, db: { example: "disconnected" }, message: { type: "string" } },
            }),
          },
        },
      },
      "/api/auth/register": {
        post: {
          tags: ["Auth"],
          summary: "Create a doctor account",
          description: "The identifier (email or registration ID) is trimmed and lowercased.",
          security: [],
          requestBody: { required: true, content: json(ref("Credentials")) },
          responses: {
            201: ok("Account created", ref("Session")),
            400: err("Validation failed"),
            409: err("An account with this identifier already exists"),
          },
        },
      },
      "/api/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Log in",
          security: [],
          requestBody: { required: true, content: json(ref("Credentials")) },
          responses: {
            200: ok("Logged in", ref("Session")),
            400: err("Validation failed"),
            401: err("Email/ID or password is incorrect"),
          },
        },
      },
      "/api/auth/me": {
        get: {
          tags: ["Auth"],
          summary: "The logged-in doctor",
          responses: { 200: ok("The doctor", { type: "object", properties: { doctor: ref("Doctor") } }), ...authErrors },
        },
      },
      "/api/auth/change-password": {
        post: {
          tags: ["Auth"],
          summary: "Change password",
          description: "Returns a fresh token. Older tokens keep working until they expire.",
          requestBody: { required: true, content: json(ref("ChangePassword")) },
          responses: {
            200: ok("Changed", { type: "object", properties: { ok: { type: "boolean" }, token: { type: "string" } } }),
            400: err("Wrong current password (`details.current`), too short, or not matching (`details.confirm`)"),
            ...authErrors,
          },
        },
      },
      "/api/doctor/profile": {
        get: {
          tags: ["Doctor"],
          summary: "Get the profile",
          responses: { 200: ok("Profile", { type: "object", properties: { doctor: ref("Doctor") } }), ...authErrors },
        },
        patch: {
          tags: ["Doctor"],
          summary: "Update the profile (partial)",
          description: "Unknown fields are rejected.",
          requestBody: { required: true, content: json(ref("ProfilePatch")) },
          responses: {
            200: ok("Updated", { type: "object", properties: { doctor: ref("Doctor") } }),
            400: err("Validation failed"),
            ...authErrors,
          },
        },
      },
      "/api/doctor/photo": {
        put: {
          tags: ["Doctor"],
          summary: "Upload or replace the profile photo",
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["photo"],
                  properties: { photo: { type: "string", format: "binary", description: `JPG or PNG, up to ${MB} MB` } },
                },
              },
            },
          },
          responses: {
            200: ok("Saved", { type: "object", properties: { doctor: ref("Doctor") } }),
            400: err("No photo"),
            413: err(`Larger than ${MB} MB`),
            415: err(`Not one of ${IMAGE_MIME_TYPES.join(", ")}`),
            ...authErrors,
          },
        },
        delete: {
          tags: ["Doctor"],
          summary: "Remove the profile photo",
          responses: { 200: ok("Removed", { type: "object", properties: { doctor: ref("Doctor") } }), ...authErrors },
        },
      },
      "/api/patients": {
        get: {
          tags: ["Patients"],
          summary: "List or search patients",
          description: "Newest first, up to 500.",
          parameters: [
            {
              name: "q",
              in: "query",
              description: "Matches the name, or phone digits (3 or more)",
              schema: { type: "string" },
            },
          ],
          responses: {
            200: ok("Patients", { type: "object", properties: { data: { type: "array", items: ref("Patient") } } }),
            ...authErrors,
          },
        },
        post: {
          tags: ["Patients"],
          summary: "Find or create a patient",
          description:
            "Matches an existing patient with the same name (case and spacing ignored) AND the same last 10 phone digits. Family members sharing a phone stay separate.",
          requestBody: { required: true, content: json(ref("NewPatient")) },
          responses: {
            200: ok("Existing patient matched", {
              type: "object",
              properties: { data: ref("Patient"), created: { type: "boolean", example: false } },
            }),
            201: ok("Patient created", {
              type: "object",
              properties: { data: ref("Patient"), created: { type: "boolean", example: true } },
            }),
            400: err("Validation failed"),
            ...authErrors,
          },
        },
      },
      "/api/patients/{id}": {
        get: {
          tags: ["Patients"],
          summary: "A patient with their appointments and records",
          parameters: [idParam("Patient")],
          responses: {
            200: ok("Patient profile", {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    patient: ref("Patient"),
                    appointments: { type: "array", items: ref("Appointment") },
                    entries: { type: "array", items: ref("RecordEntry") },
                  },
                },
              },
            }),
            400: err("Invalid id"),
            404: err("Not found (or another doctor's)"),
            ...authErrors,
          },
        },
      },
      "/api/patients/{id}/records": {
        get: {
          tags: ["Records"],
          summary: "List a patient's records",
          description: "Newest first.",
          parameters: [idParam("Patient")],
          responses: {
            200: ok("Records", { type: "object", properties: { data: { type: "array", items: ref("RecordEntry") } } }),
            404: err("Patient not found"),
            ...authErrors,
          },
        },
        post: {
          tags: ["Records"],
          summary: "Add an upload or a note",
          description: "A file is required unless `type` is `note`; a note is required when `type` is `note`.",
          parameters: [idParam("Patient")],
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["type"],
                  properties: {
                    type: { type: "string", enum: [...DOC_TYPES, "note"] },
                    note: { type: "string" },
                    file: { type: "string", format: "binary", description: `PDF, JPG or PNG, up to ${MB} MB` },
                  },
                },
              },
            },
          },
          responses: {
            201: ok("Saved", { type: "object", properties: { data: ref("RecordEntry") } }),
            400: err("Missing file or note, or bad type"),
            404: err("Patient not found"),
            413: err(`Larger than ${MB} MB`),
            415: err(`Not one of ${ACCEPTED_MIME_TYPES.join(", ")}`),
            ...authErrors,
          },
        },
      },
      "/api/appointments": {
        get: {
          tags: ["Appointments"],
          summary: "List appointments",
          description: "Earliest first, up to 1000, each with its patient.",
          parameters: [
            { name: "from", in: "query", description: "Starts at or after (ISO date-time with offset)", schema: iso },
            { name: "to", in: "query", description: "Starts before (ISO date-time with offset)", schema: iso },
            { name: "patientId", in: "query", schema: id },
          ],
          responses: {
            200: ok("Appointments", {
              type: "object",
              properties: { data: { type: "array", items: ref("AppointmentWithPatient") } },
            }),
            400: err("Bad query"),
            ...authErrors,
          },
        },
        post: {
          tags: ["Appointments"],
          summary: "Book an appointment",
          description:
            "A new patient is matched by name + phone, else created. Bookings within 30 minutes of another, or in the past, are still saved and reported in `warnings`.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: ref("NewAppointment"),
                examples: {
                  newPatient: {
                    summary: "New or returning patient by details",
                    value: {
                      startsAt: "2026-11-10T10:00:00+05:30",
                      patient: { name: "Amit Das", age: 34, phone: "+91 98300 12345", email: "" },
                    },
                  },
                  existingPatient: {
                    summary: "Existing patient by id",
                    value: { startsAt: "2026-11-10T10:00:00+05:30", patientId: "6af18f5e9f62c5cdd2ec8fb9" },
                  },
                },
              },
            },
          },
          responses: {
            201: ok("Booked", {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    appointment: ref("Appointment"),
                    patient: ref("Patient"),
                    patientCreated: { type: "boolean" },
                  },
                },
                warnings: {
                  type: "object",
                  properties: {
                    overlaps: { type: "array", items: iso, description: "Other bookings within 30 minutes" },
                    inPast: { type: "boolean" },
                  },
                },
              },
            }),
            400: err("Validation failed"),
            404: err("patientId not found"),
            ...authErrors,
          },
        },
      },
      "/api/appointments/{id}": {
        get: {
          tags: ["Appointments"],
          summary: "One appointment with its patient",
          parameters: [idParam("Appointment")],
          responses: {
            200: ok("Appointment", {
              type: "object",
              properties: {
                data: { type: "object", properties: { appointment: ref("Appointment"), patient: ref("Patient") } },
              },
            }),
            400: err("Invalid id"),
            404: err("Not found"),
            ...authErrors,
          },
        },
      },
      "/api/files/{id}": {
        get: {
          tags: ["Files"],
          summary: "Download a file",
          description:
            "A record attachment or profile photo. Send the bearer token, or instead a `sig` from `GET /api/files/{id}/link`.",
          parameters: [
            idParam("File"),
            { name: "sig", in: "query", description: "Signed link token (5 minutes, this file only)", schema: { type: "string" } },
          ],
          responses: {
            200: {
              description: "The file",
              content: {
                "application/pdf": { schema: { type: "string", format: "binary" } },
                "image/jpeg": { schema: { type: "string", format: "binary" } },
                "image/png": { schema: { type: "string", format: "binary" } },
              },
            },
            404: err("Not found (or another doctor's)"),
            ...authErrors,
          },
        },
      },
      "/api/files/{id}/link": {
        get: {
          tags: ["Files"],
          summary: "A 5-minute link to a file",
          description: "For opening a file in a browser or viewer app that can't send the Authorization header.",
          parameters: [idParam("File")],
          responses: {
            200: ok("Link", {
              type: "object",
              properties: {
                url: { type: "string", example: "/api/files/6af18f5f536b402a5e05e953?sig=eyJ..." },
                expiresIn: { type: "integer", example: 300, description: "Seconds" },
              },
            }),
            404: err("Not found"),
            ...authErrors,
          },
        },
      },
      "/api/sync": {
        get: {
          tags: ["Sync"],
          summary: "Everything for the logged-in doctor",
          description: "Profile, patients, appointments and records in one call (app start / refresh).",
          responses: {
            200: ok("All data", {
              type: "object",
              properties: {
                doctor: ref("Doctor"),
                patients: { type: "array", items: ref("Patient") },
                appointments: { type: "array", items: ref("Appointment") },
                entries: { type: "array", items: ref("RecordEntry") },
              },
            }),
            ...authErrors,
          },
        },
      },
    },
  };
}
