import {
  ALLERGY_SEVERITIES,
  GENDERS,
  PRIORITIES,
  RESOURCE_STATUSES,
  RESOURCE_TYPES,
  SERVICE_KINDS,
  SIMULATION_EVENT_TYPES,
  STAGES,
  TEST_RESULT_FLAGS,
} from "@mediflow/shared";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";

const nonnegative = (column: AnySQLiteColumn) => sql`${column} >= 0`;

export const resources = sqliteTable(
  "resources",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    type: text("type", { enum: RESOURCE_TYPES }).notNull(),
    specialty: text("specialty"),
    tag: text("tag").notNull(),
    serviceDurationMin: integer("service_duration_min"),
  },
  (table) => [
    uniqueIndex("resources_tag_unique").on(table.tag),
    check(
      "resources_type_valid",
      sql`${table.type} in ('doctor', 'lab', 'xray', 'ecg')`,
    ),
    check(
      "resources_service_duration_valid",
      sql`(${table.type} = 'doctor' and ${table.serviceDurationMin} is null) or (${table.type} <> 'doctor' and ${table.serviceDurationMin} > 0)`,
    ),
  ],
);

export const patients = sqliteTable(
  "patients",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull(),
    name: text("name").notNull(),
    age: integer("age").notNull(),
    gender: text("gender", { enum: GENDERS }).notNull(),
    arrivalMinute: integer("arrival_minute").notNull(),
    priority: text("priority", { enum: PRIORITIES }).notNull(),
    estimatedConsultationDuration: integer(
      "estimated_consultation_duration",
    ).notNull(),
    currentStage: text("current_stage", { enum: STAGES })
      .notNull()
      .default("registration"),
    queuePosition: integer("queue_position").notNull().default(0),
    serviceEndsAtMinute: integer("service_ends_at_minute"),
    currentResourceId: text("current_resource_id").references(
      () => resources.id,
      { onDelete: "set null" },
    ),
    completedAtMinute: integer("completed_at_minute"),
    waitedMin: integer("waited_min").notNull().default(0),
    servedMin: integer("served_min").notNull().default(0),
    registered: integer("registered", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("patients_token_unique").on(table.token),
    index("patients_arrival_minute_idx").on(table.arrivalMinute),
    index("patients_current_resource_idx").on(table.currentResourceId),
    check("patients_age_valid", sql`${table.age} between 0 and 120`),
    check("patients_gender_valid", sql`${table.gender} in ('male', 'female')`),
    check("patients_priority_valid", sql`${table.priority} in ('normal', 'urgent')`),
    check(
      "patients_current_stage_valid",
      sql`${table.currentStage} in ('registration', 'lab', 'xray', 'ecg', 'consultation', 'pharmacy', 'billing', 'done')`,
    ),
    check("patients_arrival_minute_nonnegative", nonnegative(table.arrivalMinute)),
    check(
      "patients_consultation_duration_positive",
      sql`${table.estimatedConsultationDuration} > 0`,
    ),
    check("patients_queue_position_nonnegative", nonnegative(table.queuePosition)),
    check("patients_waited_min_nonnegative", nonnegative(table.waitedMin)),
    check("patients_served_min_nonnegative", nonnegative(table.servedMin)),
  ],
);

export const resourceState = sqliteTable(
  "resource_state",
  {
    resourceId: text("resource_id")
      .primaryKey()
      .references(() => resources.id, { onDelete: "cascade" }),
    status: text("status", { enum: RESOURCE_STATUSES })
      .notNull()
      .default("available"),
    currentPatientId: text("current_patient_id").references(() => patients.id, {
      onDelete: "set null",
    }),
    predictedWaitMin: integer("predicted_wait_min").notNull().default(0),
    utilizationPct: integer("utilization_pct").notNull().default(0),
    busyMinutes: integer("busy_minutes").notNull().default(0),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("resource_state_current_patient_idx").on(table.currentPatientId),
    check(
      "resource_state_status_valid",
      sql`${table.status} in ('available', 'busy', 'congested')`,
    ),
    check(
      "resource_state_predicted_wait_nonnegative",
      nonnegative(table.predictedWaitMin),
    ),
    check(
      "resource_state_utilization_valid",
      sql`${table.utilizationPct} between 0 and 100`,
    ),
    check("resource_state_busy_minutes_nonnegative", nonnegative(table.busyMinutes)),
  ],
);

export const resourceQueue = sqliteTable(
  "resource_queue",
  {
    resourceId: text("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    enqueuedAtMinute: integer("enqueued_at_minute").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.resourceId, table.patientId] }),
    uniqueIndex("resource_queue_position_unique").on(
      table.resourceId,
      table.position,
    ),
    index("resource_queue_patient_idx").on(table.patientId),
    check("resource_queue_position_positive", sql`${table.position} > 0`),
    check(
      "resource_queue_enqueued_minute_nonnegative",
      nonnegative(table.enqueuedAtMinute),
    ),
  ],
);

export const requiredServices = sqliteTable(
  "required_services",
  {
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    kind: text("kind", { enum: SERVICE_KINDS }).notNull(),
    doctorId: text("doctor_id").references(() => resources.id, {
      onDelete: "restrict",
    }),
    completed: integer("completed", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (table) => [
    primaryKey({ columns: [table.patientId, table.position] }),
    index("required_services_doctor_idx").on(table.doctorId),
    check("required_services_position_nonnegative", nonnegative(table.position)),
    check(
      "required_services_kind_valid",
      sql`${table.kind} in ('consultation', 'lab', 'xray', 'ecg')`,
    ),
    check(
      "required_services_doctor_consistency",
      sql`(${table.kind} = 'consultation' and ${table.doctorId} is not null) or (${table.kind} <> 'consultation' and ${table.doctorId} is null)`,
    ),
  ],
);

export const patientTimeline = sqliteTable(
  "patient_timeline",
  {
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    stage: text("stage", { enum: STAGES }).notNull(),
    startedAtMinute: integer("started_at_minute"),
    endedAtMinute: integer("ended_at_minute"),
  },
  (table) => [
    primaryKey({ columns: [table.patientId, table.position] }),
    check("patient_timeline_position_nonnegative", nonnegative(table.position)),
    check(
      "patient_timeline_stage_valid",
      sql`${table.stage} in ('registration', 'lab', 'xray', 'ecg', 'consultation', 'pharmacy', 'billing', 'done')`,
    ),
    check(
      "patient_timeline_order_valid",
      sql`${table.endedAtMinute} is null or ${table.startedAtMinute} is null or ${table.endedAtMinute} >= ${table.startedAtMinute}`,
    ),
  ],
);

export const diagnoses = sqliteTable(
  "diagnoses",
  {
    id: text("id").primaryKey(),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    condition: text("condition").notNull(),
    year: integer("year").notNull(),
  },
  (table) => [index("diagnoses_patient_idx").on(table.patientId)],
);

export const medications = sqliteTable(
  "medications",
  {
    id: text("id").primaryKey(),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    dose: text("dose").notNull(),
    frequency: text("frequency").notNull(),
  },
  (table) => [index("medications_patient_idx").on(table.patientId)],
);

export const allergies = sqliteTable(
  "allergies",
  {
    id: text("id").primaryKey(),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    substance: text("substance").notNull(),
    reaction: text("reaction").notNull(),
    severity: text("severity", { enum: ALLERGY_SEVERITIES }).notNull(),
  },
  (table) => [
    index("allergies_patient_idx").on(table.patientId),
    check(
      "allergies_severity_valid",
      sql`${table.severity} in ('mild', 'moderate', 'severe')`,
    ),
  ],
);

export const testResults = sqliteTable(
  "test_results",
  {
    id: text("id").primaryKey(),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    test: text("test").notNull(),
    value: text("value").notNull(),
    date: text("date").notNull(),
    flag: text("flag", { enum: TEST_RESULT_FLAGS }).notNull(),
  },
  (table) => [
    index("test_results_patient_idx").on(table.patientId),
    check(
      "test_results_flag_valid",
      sql`${table.flag} in ('normal', 'abnormal')`,
    ),
  ],
);

export const treatments = sqliteTable(
  "treatments",
  {
    id: text("id").primaryKey(),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    procedure: text("procedure").notNull(),
    date: text("date").notNull(),
    note: text("note").notNull(),
  },
  (table) => [index("treatments_patient_idx").on(table.patientId)],
);

export const simulationState = sqliteTable(
  "simulation_state",
  {
    id: text("id").primaryKey(),
    minute: integer("minute").notNull().default(0),
    playbackStatus: text("playback_status", {
      enum: ["paused", "playing"],
    })
      .notNull()
      .default("paused"),
    speed: integer("speed").notNull().default(1),
    seed: integer("seed").notNull(),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    check("simulation_state_minute_nonnegative", nonnegative(table.minute)),
    check(
      "simulation_state_playback_status_valid",
      sql`${table.playbackStatus} in ('paused', 'playing')`,
    ),
    check("simulation_state_speed_valid", sql`${table.speed} in (1, 4)`),
  ],
);

export const simulationEvents = sqliteTable(
  "simulation_events",
  {
    id: text("id").primaryKey(),
    simulationMinute: integer("simulation_minute").notNull(),
    type: text("type", { enum: SIMULATION_EVENT_TYPES }).notNull(),
    orderInMinute: integer("order_in_minute").notNull(),
    patientId: text("patient_id").references(() => patients.id, {
      onDelete: "cascade",
    }),
    resourceId: text("resource_id").references(() => resources.id, {
      onDelete: "cascade",
    }),
    payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("simulation_events_minute_idx").on(table.simulationMinute),
    uniqueIndex("simulation_events_minute_order_unique").on(
      table.simulationMinute,
      table.orderInMinute,
    ),
    index("simulation_events_patient_idx").on(table.patientId),
    index("simulation_events_resource_idx").on(table.resourceId),
    check(
      "simulation_events_type_valid",
      sql`${table.type} in ('simulation_initialized', 'clock_advanced', 'patient_arrived', 'patient_queued', 'service_started', 'service_completed', 'recommendation_created')`,
    ),
    check(
      "simulation_events_minute_nonnegative",
      nonnegative(table.simulationMinute),
    ),
    check(
      "simulation_events_order_nonnegative",
      nonnegative(table.orderInMinute),
    ),
  ],
);

export const metricSnapshots = sqliteTable(
  "metric_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    simulationMinute: integer("simulation_minute").notNull(),
    kind: text("kind", { enum: ["live", "baseline"] }).notNull(),
    avgWaitMin: integer("avg_wait_min").notNull(),
    avgVisitMin: integer("avg_visit_min").notNull(),
    utilizationPct: integer("utilization_pct").notNull(),
    avgQueueDepth: integer("avg_queue_depth").notNull().default(0),
    peakQueueDepth: integer("peak_queue_depth").notNull().default(0),
    patientsInHouse: integer("patients_in_house").notNull(),
    completed: integer("completed").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("metric_snapshots_kind_minute_unique").on(
      table.kind,
      table.simulationMinute,
    ),
    check(
      "metric_snapshots_kind_valid",
      sql`${table.kind} in ('live', 'baseline')`,
    ),
    check("metric_snapshots_minute_nonnegative", nonnegative(table.simulationMinute)),
    check("metric_snapshots_wait_nonnegative", nonnegative(table.avgWaitMin)),
    check("metric_snapshots_visit_nonnegative", nonnegative(table.avgVisitMin)),
    check(
      "metric_snapshots_utilization_valid",
      sql`${table.utilizationPct} between 0 and 100`,
    ),
    check(
      "metric_snapshots_avg_queue_depth_nonnegative",
      nonnegative(table.avgQueueDepth),
    ),
    check(
      "metric_snapshots_peak_queue_depth_nonnegative",
      nonnegative(table.peakQueueDepth),
    ),
    check(
      "metric_snapshots_patients_in_house_nonnegative",
      nonnegative(table.patientsInHouse),
    ),
    check("metric_snapshots_completed_nonnegative", nonnegative(table.completed)),
  ],
);

export const llmOutputs = sqliteTable(
  "llm_outputs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    cacheKey: text("cache_key").notNull(),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    kind: text("kind", {
      enum: ["recommendation_explanation", "doctor_brief"],
    }).notNull(),
    sourceHash: text("source_hash").notNull(),
    content: text("content").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("llm_outputs_cache_key_unique").on(table.cacheKey),
    index("llm_outputs_patient_kind_idx").on(table.patientId, table.kind),
    check(
      "llm_outputs_kind_valid",
      sql`${table.kind} in ('recommendation_explanation', 'doctor_brief')`,
    ),
  ],
);
