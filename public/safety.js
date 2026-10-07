// These notices are written by the app and shown for AI and sample activities alike.
export function safetyNotes(activity={}) {
 const notes=['Choose a safe spot away from traffic, edges and water. Stop if the weather or place feels unsafe.','Observe without tasting anything or touching unknown plants, insects or animals. Do not climb or look at the sun.'];
 if(activity.audience==='Class'||activity.audience==='Family') notes.unshift('An adult leads: agree boundaries, keep everyone in sight, and count the group before and after.');
 else if(activity.ageRange && activity.ageRange!=='Adults') notes.unshift('A child needs an adult nearby throughout the activity.');
 if(activity.place==='By a window') notes.push('Stay indoors. Keep the window closed and do not lean out or reach outside.');
 if(activity.place==='From a doorway'||activity.place==='Outside my doorway') notes.push('Stay at the doorway; keep the entrance clear and do not step into traffic.');
 if(activity.mobility==='Seated') notes.push('Stay seated and use only what you can see or reach comfortably.');
 return notes;
}
