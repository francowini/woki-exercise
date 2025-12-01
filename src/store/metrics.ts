interface TimingSample {
  value: number;
  ts: number;
}

class MetricsStore {
  private bookingsCreated = 0;
  private bookingsCancelled = 0;
  private bookingConflicts = 0;
  private lockWaits = 0;
  private lockAcquired = 0;

  private assignmentTimes: TimingSample[] = [];
  private readonly maxSamples = 100;

  incCreated() {
    this.bookingsCreated++;
  }

  incCancelled() {
    this.bookingsCancelled++;
  }

  incConflict() {
    this.bookingConflicts++;
  }

  incLockWait() {
    this.lockWaits++;
  }

  incLockAcquired() {
    this.lockAcquired++;
  }

  recordAssignmentTime(ms: number) {
    this.assignmentTimes.push({ value: ms, ts: Date.now() });
    if (this.assignmentTimes.length > this.maxSamples) {
      this.assignmentTimes.shift();
    }
  }

  private calcP95(): number | null {
    if (this.assignmentTimes.length < 5) return null;
    const sorted = [...this.assignmentTimes].map(s => s.value).sort((a, b) => a - b);
    const idx = Math.floor(sorted.length * 0.95);
    return sorted[idx];
  }

  getSnapshot() {
    const p95 = this.calcP95();
    return {
      bookings: {
        created: this.bookingsCreated,
        cancelled: this.bookingsCancelled,
        conflicts: this.bookingConflicts,
      },
      locks: {
        acquired: this.lockAcquired,
        waits: this.lockWaits,
        contentionRate: this.lockAcquired > 0
          ? Number((this.lockWaits / this.lockAcquired).toFixed(3))
          : 0,
      },
      timing: {
        assignmentP95Ms: p95,
        sampleCount: this.assignmentTimes.length,
      },
    };
  }
}

export const metrics = new MetricsStore();
