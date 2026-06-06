import { closeDb, getWaitlist } from '../db/client';

async function main() {
  const waitlist = await getWaitlist();
  const total = await waitlist.countDocuments();
  const assigned = await waitlist.countDocuments({ has_current_appointment: true });
  const byTreatment = await waitlist
    .aggregate([{ $group: { _id: '$desired_treatment', n: { $sum: 1 } } }, { $sort: { _id: 1 } }])
    .toArray();

  console.log('Total docs:', total);
  console.log('Assigned (has_current_appointment=true):', assigned);
  console.log('By treatment:', byTreatment);

  const sample = await waitlist.findOne({ _id: 'P0004' });
  console.log('\nSample doc P0004 (types normalized):');
  console.dir(sample, { depth: null });

  await closeDb();
}

main().catch(async (e) => {
  console.error(e);
  await closeDb();
  process.exit(1);
});
