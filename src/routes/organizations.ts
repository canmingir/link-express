import express, { Request, Response } from "express";
import Organization from "../models/Organization.model";
import Permission from "../models/Permission.model";

const router = express.Router();

router.post("/", async (req: Request, res: Response) => {
  const organization = req.body;

  Organization.create(organization).then((organization) => {
    res.status(201).json(organization);
  });
});

router.get("/", async (req: Request, res: Response) => {
  const { userId } = req.session;

  const organizations = await Organization.findAll({
    include: [
      {
        model: Permission,
        as: "permissions",
        where: { userId },
        attributes: [],
      },
    ],
  });

  res.status(200).json(organizations);
});

router.get("/:id", async (req: Request, res: Response) => {
  const { organizationId } = req.session;
  const { id } = req.params;

  if (organizationId !== id) {
    return res.status(401).end();
  }

  const organization = await Organization.findByPk(organizationId);
  return res.status(200).json(organization);
});

export default router;
