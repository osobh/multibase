-- CreateTable
CREATE TABLE "Instance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "basePort" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Metric" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "instanceId" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "cpu" REAL NOT NULL,
    "memory" REAL NOT NULL,
    "networkRx" REAL NOT NULL,
    "networkTx" REAL NOT NULL,
    "diskRead" REAL NOT NULL,
    "diskWrite" REAL NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Metric_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "instanceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "threshold" REAL,
    "duration" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL,
    "triggeredAt" DATETIME,
    "acknowledgedAt" DATETIME,
    "resolvedAt" DATETIME,
    "message" TEXT,
    "notificationChannels" TEXT,
    "webhookUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Alert_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SystemMetric" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "totalCpu" REAL NOT NULL,
    "totalMemory" REAL NOT NULL,
    "totalDisk" REAL NOT NULL,
    "instanceCount" INTEGER NOT NULL,
    "runningCount" INTEGER NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Instance_name_key" ON "Instance"("name");

-- CreateIndex
CREATE INDEX "Instance_name_idx" ON "Instance"("name");

-- CreateIndex
CREATE INDEX "Instance_status_idx" ON "Instance"("status");

-- CreateIndex
CREATE INDEX "Metric_instanceId_timestamp_idx" ON "Metric"("instanceId", "timestamp");

-- CreateIndex
CREATE INDEX "Metric_service_idx" ON "Metric"("service");

-- CreateIndex
CREATE INDEX "Alert_instanceId_idx" ON "Alert"("instanceId");

-- CreateIndex
CREATE INDEX "Alert_status_idx" ON "Alert"("status");

-- CreateIndex
CREATE INDEX "Alert_rule_idx" ON "Alert"("rule");

-- CreateIndex
CREATE INDEX "SystemMetric_timestamp_idx" ON "SystemMetric"("timestamp");
