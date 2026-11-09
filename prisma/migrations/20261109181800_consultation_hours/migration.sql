-- Owner's consultation hours (Nov 9, 2026): consultations 2pm–9pm every day.
-- Clinic is open 10am–9pm on weekdays, but consultations start at 2pm, so online booking only offers 2pm onwards.
-- Can be changed later in Settings → Schedule.
DELETE FROM "ScheduleRule";
INSERT INTO "ScheduleRule" ("id", "weekday", "startTime", "endTime") VALUES
  ('sched_consult_0', 0, '14:00', '21:00'),
  ('sched_consult_1', 1, '14:00', '21:00'),
  ('sched_consult_2', 2, '14:00', '21:00'),
  ('sched_consult_3', 3, '14:00', '21:00'),
  ('sched_consult_4', 4, '14:00', '21:00'),
  ('sched_consult_5', 5, '14:00', '21:00'),
  ('sched_consult_6', 6, '14:00', '21:00');
