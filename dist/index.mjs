import{readFile as e}from"node:fs/promises";import{join as t}from"node:path";import{singleton as n}from"@rheactor/rheactor-core";import{escapeIdentifierSmart as r}from"@rheactor/rheactor-core/postgres";var i=class{data;constructor(e=[]){this.data=e}push(...e){return this.data.push(...e),this}pushIdentifier(e,t){return typeof t==`string`?(this.data.push(`${r(t)}.${r(e)}`),this):(this.data.push(r(e)),this)}pop(){return this.data.pop(),this}amend(...e){return this.data.pop(),this.data.push(...e),this}build(e=`;`){return this.data.push(e),this.data.filter(Boolean).join(``)}};function a(e,t){e.push(`WITH (`);for(let n of t)e.push(n,`, `);return e.amend(`)`),e}function o(e){let t=new i([`CREATE `,e.unlogged&&`UNLOGGED `,`TABLE ${r(e.name)} `]);if(e.columns!==null&&e.columns.length>0){t.push(`(
`);for(let n of e.columns){if(t.push(`  ${r(n.name)} ${n.type}`),n.collate!==null&&t.push(` COLLATE `).pushIdentifier(n.collate.name,n.collate.schema),n.notNull.enabled&&(n.notNull.constraint!==null&&t.push(` CONSTRAINT `).pushIdentifier(n.notNull.constraint),t.push(` NOT NULL`)),n.default!==null)t.push(` DEFAULT ${n.default}`);else if(n.generated!==null)t.push(` GENERATED ALWAYS AS (${n.generated.expression}) ${n.generated.type===`s`?`STORED`:`VIRTUAL`}`);else if(n.identity!==null){t.push(` GENERATED ${n.identity.type===`a`?`ALWAYS`:`BY DEFAULT`} AS IDENTITY`);let e=[];n.identity.sequence.name!==null&&e.push(`SEQUENCE NAME ${r(n.identity.sequence.name)}`,` `),n.identity.sequence.startWith!==null&&e.push(`START WITH ${n.identity.sequence.startWith}`,` `),n.identity.sequence.incrementBy!==null&&e.push(`INCREMENT BY ${n.identity.sequence.incrementBy}`,` `),n.identity.sequence.minValue!==null&&e.push(`MINVALUE ${n.identity.sequence.minValue}`,` `),n.identity.sequence.maxValue!==null&&e.push(`MAXVALUE ${n.identity.sequence.maxValue}`,` `),n.identity.sequence.cache!==null&&e.push(`CACHE ${n.identity.sequence.cache}`,` `),n.identity.sequence.cycle&&e.push(`CYCLE`,` `),e.length>0&&t.push(` (`,...(e.pop(),e),`)`)}t.push(`,
`)}t.amend(`
)`,`
`)}else t.push(`()`,`
`);if(e.inherits!==null){t.push(`INHERITS (`);for(let n of e.inherits)t.pushIdentifier(n.name,n.schema).push(`, `);t.amend(`)`,`
`)}if(e.withOptions.length>0&&a(t,e.withOptions).push(`
`),t.amend(`;

`),e.constraints!==null&&e.constraints.length>0)for(let n of e.constraints)t.push(`ALTER TABLE ONLY ${r(e.name)} ADD CONSTRAINT ${r(n.name)} ${n.expression}`,` `),n.withOptions!==null&&a(t,n.withOptions).push(` `),t.amend(`;

`);if(e.indexes!==null)for(let n of e.indexes)t.push(n,`

`);return t.pop().build()}const s=import.meta.dirname,c=n(async()=>e(t(s,`dump.sql`),`utf-8`));async function l(e,t){let n=await c(),{rows:r}=await e.query(n,[t?.schema??`public`,t?.tables]),i=[];for(let e of r)i.push(o(e));return{sql:i.join(`

`),tables:r.map(({name:e})=>e)}}export{l as dump};