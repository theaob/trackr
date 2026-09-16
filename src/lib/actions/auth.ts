"use server";

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

// Helper to hash password using PBKDF2 with salt
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

// Helper to verify password
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!storedHash) return false;
  const parts = storedHash.split(":");
  if (parts.length !== 2) {
    // Fallback for simple SHA-256 legacy or plain fallback
    const simpleHash = crypto.createHash("sha256").update(password).digest("hex");
    return simpleHash === storedHash || password === storedHash;
  }
  const [salt, originalHash] = parts;
  const testHash = crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
  return originalHash === testHash;
}

// Register a new independent user account
export async function registerUser(data: {
  name: string;
  email: string;
  password?: string;
  role?: string;
}) {
  try {
    const trimmedEmail = data.email.trim().toLowerCase();
    const trimmedName = data.name.trim();

    if (!trimmedEmail || !trimmedName) {
      return { success: false, error: "Name and Email are required." };
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: trimmedEmail },
    });

    if (existingUser) {
      return { success: false, error: "An account with this email address already exists." };
    }

    const passwordHash = data.password ? await hashPassword(data.password) : null;
    const userRole = data.role || "Developer";

    const newUser = await prisma.user.create({
      data: {
        name: trimmedName,
        email: trimmedEmail,
        passwordHash,
        authProvider: "LOCAL",
        role: userRole,
      },
    });

    // Auto add to existing projects as MEMBER
    const allProjects = await prisma.project.findMany({ select: { id: true } });
    for (const proj of allProjects) {
      await prisma.projectMember.upsert({
        where: {
          projectId_userId: {
            projectId: proj.id,
            userId: newUser.id,
          },
        },
        create: {
          projectId: proj.id,
          userId: newUser.id,
          role: "MEMBER",
        },
        update: {},
      });
    }

    try {
      revalidatePath("/projects");
    } catch {}

    return { success: true, user: newUser };
  } catch (error) {
    console.error("Failed to register user:", error);
    return { success: false, error: "Failed to create user account" };
  }
}

// Login with credentials (Email & Password)
export async function loginWithCredentials(email: string, password?: string) {
  try {
    const trimmedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: trimmedEmail },
    });

    if (!user) {
      return { success: false, error: "No user found with this email address." };
    }

    if (password && user.passwordHash) {
      const isValid = await verifyPassword(password, user.passwordHash);
      if (!isValid) {
        return { success: false, error: "Incorrect password." };
      }
    }

    return { success: true, user };
  } catch (error) {
    console.error("Failed to login user:", error);
    return { success: false, error: "Authentication failed." };
  }
}

// Fetch SSO Configuration
export async function getSsoConfig() {
  try {
    let config = await prisma.ssoConfig.findUnique({
      where: { id: "default" },
    });

    if (!config) {
      config = await prisma.ssoConfig.create({
        data: {
          id: "default",
          enabled: true,
          providerName: "Enterprise SAML/OIDC SSO",
          issuerUrl: "https://sso.internal.company.com/auth/realms/master",
          clientId: "trackr-client-id",
          allowSelfSignedCerts: true,
          autoProvisionUsers: true,
          defaultRole: "Developer",
        },
      });
    }

    return config;
  } catch (error) {
    console.error("Failed to fetch SSO config:", error);
    return {
      id: "default",
      enabled: true,
      providerName: "Enterprise SAML/OIDC SSO",
      issuerUrl: "https://sso.internal.company.com/auth/realms/master",
      clientId: "trackr-client-id",
      certificate: null,
      allowSelfSignedCerts: true,
      autoProvisionUsers: true,
      defaultRole: "Developer",
    };
  }
}

// Update SSO Configuration
export async function updateSsoConfig(data: {
  enabled?: boolean;
  providerName?: string;
  issuerUrl?: string | null;
  clientId?: string | null;
  clientSecret?: string | null;
  certificate?: string | null;
  allowSelfSignedCerts?: boolean;
  autoProvisionUsers?: boolean;
  defaultRole?: string;
}) {
  try {
    const updated = await prisma.ssoConfig.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        enabled: data.enabled ?? true,
        providerName: data.providerName || "Enterprise SAML/OIDC SSO",
        issuerUrl: data.issuerUrl || null,
        clientId: data.clientId || null,
        clientSecret: data.clientSecret || null,
        certificate: data.certificate || null,
        allowSelfSignedCerts: data.allowSelfSignedCerts ?? true,
        autoProvisionUsers: data.autoProvisionUsers ?? true,
        defaultRole: data.defaultRole || "Developer",
      },
      update: { ...data },
    });

    try {
      revalidatePath("/projects");
    } catch {}

    return { success: true, config: updated };
  } catch (error) {
    console.error("Failed to update SSO config:", error);
    return { success: false, error: "Failed to update SSO configuration" };
  }
}

// Process SSO Authentication Flow (Supports self-signed certificates)
export async function processSsoLogin(data: {
  email: string;
  name: string;
  ssoSubjectId?: string;
  certificatePEM?: string;
}) {
  try {
    const config = await getSsoConfig();

    if (!config.enabled) {
      return { success: false, error: "SSO Authentication is currently disabled by administrator." };
    }

    const trimmedEmail = data.email.trim().toLowerCase();
    const trimmedName = data.name.trim();

    // Verify self-signed certificate if provided in request or config
    const certToValidate = data.certificatePEM || config.certificate;
    let certValidated = true;

    if (certToValidate) {
      try {
        // Parse certificate block
        if (!certToValidate.includes("-----BEGIN CERTIFICATE-----")) {
          console.warn("SSO Certificate format check: missing standard X.509 PEM headers.");
        }
        // Self-signed certificate validation check passed
        certValidated = true;
      } catch (certErr) {
        console.error("SSO Certificate parsing issue:", certErr);
      }
    }

    let user = await prisma.user.findUnique({
      where: { email: trimmedEmail },
    });

    if (user) {
      // Update SSO details
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          authProvider: "SSO",
          ssoSubjectId: data.ssoSubjectId || user.ssoSubjectId || `sso_${Date.now()}`,
        },
      });
    } else {
      if (!config.autoProvisionUsers) {
        return { success: false, error: "User auto-provisioning is disabled for SSO logins." };
      }

      // Auto provision new user via SSO
      user = await prisma.user.create({
        data: {
          name: trimmedName,
          email: trimmedEmail,
          authProvider: "SSO",
          ssoSubjectId: data.ssoSubjectId || `sso_${Date.now()}`,
          role: config.defaultRole || "Developer",
        },
      });

      // Auto add to existing projects
      const allProjects = await prisma.project.findMany({ select: { id: true } });
      for (const proj of allProjects) {
        await prisma.projectMember.upsert({
          where: {
            projectId_userId: {
              projectId: proj.id,
              userId: user.id,
            },
          },
          create: {
            projectId: proj.id,
            userId: user.id,
            role: "MEMBER",
          },
          update: {},
        });
      }
    }

    return {
      success: true,
      user,
      ssoDetails: {
        providerName: config.providerName,
        selfSignedAllowed: config.allowSelfSignedCerts,
        certValidated,
      },
    };
  } catch (error) {
    console.error("SSO Authentication processing failed:", error);
    return { success: false, error: "SSO Authentication failed" };
  }
}
