import {test} from 'node:test';import assert from 'node:assert/strict';
import {learningDiagram,diagramHtml} from '../public/diagrams.js';
import {samples} from '../public/samples.js';
test('sample activities get relevant diagrams, with distinct concepts',()=>{
 assert.deepEqual(samples.map(a=>learningDiagram(a).kind),['shadows','symmetry','biodiversity']);
 assert.equal(learningDiagram({topic:'Parts of a plant'}).kind,'plants');
 assert.equal(learningDiagram({topic:'Plant growth'}).kind,'plants');
});
test('unsupported topics have no unrelated illustration and user text cannot become SVG markup',()=>{
 assert.match(diagramHtml({topic:'Fractions'}),/Unit fractions/);
 assert.match(diagramHtml({topic:'Limelight politics'}),/no matched illustration/);
 const html=diagramHtml({topic:'Shadows <script>alert(1)</script>',title:'<img onerror=bad>'});
 assert.ok(html.includes('data:image/svg+xml'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('onerror'));
});
test('diagrams distinguish illustrations from evidence and offer a portable SVG',()=>{
 for(const activity of [...samples,{topic:'Plant parts'}]){
 const html=diagramHtml(activity),diagram=learningDiagram(activity);
 assert.match(html,/LEARNING ILLUSTRATION/);assert.match(html,/not your field evidence/);
 assert.match(html,/download="outsideclass-/);assert.match(diagram.svg,/<svg xmlns=/);
 assert.ok(!diagram.svg.includes('<script'));assert.ok(!diagram.svg.includes('http://')||diagram.svg.includes('http://www.w3.org/2000/svg'));
 }
});
