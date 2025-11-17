import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting database seeding...");

  // Load configuration files
  const configDir = path.join(__dirname, "../../../config");
  const presentersPath = path.join(configDir, "presenters.json");
  const showsDir = path.join(configDir, "shows");

  // Seed presenters
  console.log("Seeding presenters...");
  const presentersData = JSON.parse(fs.readFileSync(presentersPath, "utf-8"));

  for (const presenter of presentersData.presenters) {
    await prisma.presenter.upsert({
      where: { id: presenter.id },
      update: {
        name: presenter.name,
        personaJson: JSON.stringify(presenter),
      },
      create: {
        id: presenter.id,
        name: presenter.name,
        personaJson: JSON.stringify(presenter),
      },
    });
    console.log(`  ✓ Seeded presenter: ${presenter.name}`);
  }

  // Seed shows
  console.log("Seeding shows...");
  const showFiles = fs
    .readdirSync(showsDir)
    .filter((file) => file.endsWith(".json"));

  for (const showFile of showFiles) {
    const showPath = path.join(showsDir, showFile);
    const showData = JSON.parse(fs.readFileSync(showPath, "utf-8"));

    await prisma.show.upsert({
      where: { id: showData.id },
      update: {
        name: showData.name,
        description: showData.description,
        startHour: showData.schedule.start_hour,
        durationHours: showData.schedule.duration_hours,
        talkFraction: showData.ratios.talk_fraction,
        musicFraction: showData.ratios.music_fraction,
        presenterIds: JSON.stringify(showData.presenters),
        configJson: JSON.stringify(showData),
      },
      create: {
        id: showData.id,
        name: showData.name,
        description: showData.description,
        startHour: showData.schedule.start_hour,
        durationHours: showData.schedule.duration_hours,
        talkFraction: showData.ratios.talk_fraction,
        musicFraction: showData.ratios.music_fraction,
        presenterIds: JSON.stringify(showData.presenters),
        configJson: JSON.stringify(showData),
      },
    });
    console.log(`  ✓ Seeded show: ${showData.name}`);
  }

  // Seed some example requests
  console.log("Seeding example requests...");
  const exampleRequests = [
    {
      type: "music",
      rawText: "Chill sunset vibes with jazzy piano and lo-fi beats",
      votes: 12,
      status: "pending",
      moderationStatus: "approved",
    },
    {
      type: "talk",
      rawText: "Tips for staying productive while working from home",
      votes: 8,
      status: "pending",
      moderationStatus: "approved",
    },
    {
      type: "music",
      rawText: "Rainy day coffee shop atmosphere with soft guitar",
      votes: 15,
      status: "pending",
      moderationStatus: "approved",
    },
    {
      type: "music",
      rawText: "Late night coding session with deep focus beats",
      votes: 20,
      status: "pending",
      moderationStatus: "approved",
    },
    {
      type: "music",
      rawText: "Morning coffee and newspaper vibes",
      votes: 5,
      status: "pending",
      moderationStatus: "approved",
    },
  ];

  for (const reqData of exampleRequests) {
    await prisma.request.create({
      data: reqData,
    });
  }
  console.log(`  ✓ Seeded ${exampleRequests.length} example requests`);

  console.log("Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
