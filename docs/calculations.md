# How MediFlow Calculates Recommendations and Metrics

This reference explains the deterministic calculations behind the Staff
dashboard, resource cards, patient guidance, and before/after comparison.
Every value uses persisted simulation data; the frontend displays the API
snapshot and does not recalculate scheduling logic.

## Time model and notation

The simulation advances in one-minute increments. Let:

- `t` = the current simulated minute after a tick
- `d(p, r)` = the duration of patient `p` at resource `r`
- `Q(r)` = the ordered waiting queue for resource `r`
- `activeRemaining(r)` = minutes until the current service at `r` ends, or `0`
  when the resource is idle

Diagnostic resource durations come from the resource definition. Consultation
duration comes from the patient's estimated consultation duration. Playback
speed changes how often the browser requests a tick; it never changes the
one-minute calculation.

## Next-step recommendation

For every registered patient who is not completed, active, or already queued,
MediFlow evaluates each unfinished required service.

For a candidate service at resource `r`:

```text
workAhead(p, r) = activeRemaining(r)
                  + Σ d(q, r) for each queue entry q ahead of p in Q(r)

projectedServiceFinish(p, r) = t + workAhead(p, r) + d(p, r)

projectedVisitFinish(p, r) = t + workAhead(p, r)
                             + Σ d(p, s) for all unfinished services s
```

The engine selects the candidate with the lowest `projectedVisitFinish`.
If there is a tie, it chooses the earlier required-service position, then the
lexicographically smaller resource ID. This includes choosing among the three
operationally interchangeable simulated doctors for consultation.

The `projectedServiceFinish` is saved with the recommendation event. It is an
auditable planning value, not an LLM output.

## Queue order and patient wait

Each resource queue is sorted by these fixed keys:

1. Priority: `urgent` before `normal`
2. Queue-entry minute: earlier first
3. Patient ID: deterministic final tie-breaker

Urgent priority changes only the order of patients who are waiting. It never
interrupts a service already in progress. A patient can be in at most one
queue and can receive at most one active service.

At each tick, a patient's accumulated `waitedMin` increases by one only if
they were already queued at the start of that minute. Therefore:

```text
patientWait(p) = number of elapsed ticks where p was waiting in a resource queue
```

The estimated wait shown for a queued patient is calculated from the current
state, not from historical `waitedMin`:

```text
estimatedWait(p, r) = activeRemaining(r)
                      + Σ d(q, r) for queue entries q ahead of p
```

For an active patient, estimated wait is the remaining active-service time.

## Resource status and utilization

For a resource, `predictedWaitMin` begins with its active remaining time and
adds the duration of every waiting patient in queue order:

```text
predictedWait(r) = activeRemaining(r) + Σ d(q, r) for q in Q(r)
```

The resource is classified as:

| Status | Condition |
| --- | --- |
| Available | No active patient and not congested |
| Busy | Active patient and not congested |
| Congested | Queue length is at least 4 **or** predicted wait exceeds 25 minutes |

`busyMinutes(r)` increases by one for each tick in which that resource was
already busy at the start of the minute. Its displayed utilization is:

```text
utilization(r) = round(100 × busyMinutes(r) / max(1, t))
```

The live hospital-wide utilization metric is the mean of the per-resource
utilization values, rounded to one decimal place.

## Dashboard metrics

The Worker saves a live metric snapshot after every atomic tick. The dashboard
uses the current persisted snapshot history.

| Metric | Calculation |
| --- | --- |
| Average wait | `round(mean(waitedMin))` across all patients who have arrived. |
| Average visit duration | If one or more patients are completed: `round(mean(completedAt − arrivalMinute))` across completed patients. Before the first completion: `round(mean(t − arrivalMinute))` across patients still in the hospital. |
| Patients in house | Arrived patients whose `completedAt` is empty. |
| Completed | Arrived patients whose `completedAt` has a value. |
| Current queue depth | Sum of all resource queue lengths after scheduling that minute. |
| Average queue depth | Mean of the saved current queue-depth values across all live snapshots, rounded to one decimal place. |
| Peak queue depth | Largest saved current queue-depth value across all live snapshots. |

The KPI percentage delta is calculated in the Staff view as:

```text
deltaPercent = round(100 × (MediFlow − baseline) / baseline)
```

For wait, visit duration, and queue depth, a negative delta is favorable. For
utilization, a positive delta is favorable. If the baseline is zero, the UI
shows `0%` rather than dividing by zero.

## Uncoordinated baseline

The baseline is calculated during demo reset from the identical patient and
resource fixture. It is deliberately simple so that the comparison isolates
the value of coordination:

- Every patient follows `lab → X-ray → ECG → consultation`, skipping services
  they do not require.
- Each resource uses naive FIFO ordered by ready time, then patient ID.
- It has no urgent-priority queue ordering and no service reordering.
- Each service starts at `max(patientReadyMinute, resourceFreeMinute)`.

For each baseline service request:

```text
start = max(readyMinute, resourceFreeAt)
wait contribution = start − readyMinute
end = start + duration
```

Baseline average wait, visit duration, utilization, average queue depth, and
peak queue depth use the same definitions as above, measured across the full
baseline run. The result is stored as a baseline metric snapshot, so both
columns in the dashboard originate from the same deterministic seed.

## LLM output is not a calculation input

Gemini receives the already-calculated recommendation facts and simulated
history. It returns human-readable patient guidance or a doctor brief. It does
not supply durations, priority, queue position, resource selection, metrics,
or clinical decisions. If Gemini times out or is unavailable, deterministic
fallback text is used and all calculations remain identical.

For the surrounding architecture and real-world integration path, see the
[technical walkthrough](technical-walkthrough.md).
