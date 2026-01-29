import{c,r as o,s as y,j as a,h as g}from"./index-6OJhfjKP.js";import{D as v,b as D,c as k,d as T,e as b}from"./dialog-CFjhGf-B.js";import{T as H,a as M,b as p,c as s,d as _,e as r}from"./table-B_Z-CztY.js";import{u as E}from"./use-toast-DasFaehQ.js";import{f as L}from"./dateUtils-eJ5e6apA.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const P=c("Gem",[["path",{d:"M6 3h12l4 6-10 13L2 9Z",key:"1pcd5k"}],["path",{d:"M11 3 8 9l4 13 4-13-3-6",key:"1fcu3u"}],["path",{d:"M2 9h20",key:"16fsjt"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const R=c("History",[["path",{d:"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",key:"1357e3"}],["path",{d:"M3 3v5h5",key:"1xhq8a"}],["path",{d:"M12 7v5l4 2",key:"1fdv2h"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const S=c("Pencil",[["path",{d:"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",key:"1a8usu"}],["path",{d:"m15 5 4 4",key:"1mk7zo"}]]);function q({doadoraId:t,doadoraNome:n,open:i,onClose:x}){const[d,m]=o.useState([]),[j,l]=o.useState(!1),{toast:f}=E();o.useEffect(()=>{i&&t&&u()},[i,t]);const u=async()=>{try{l(!0);const{data:e,error:h}=await y.from("aspiracoes_doadoras").select("*").eq("doadora_id",t).order("data_aspiracao",{ascending:!1});if(h)throw h;m(e||[])}catch(e){f({title:"Erro ao carregar histórico",description:e instanceof Error?e.message:"Erro desconhecido",variant:"destructive"})}finally{l(!1)}};return a.jsx(v,{open:i,onOpenChange:x,children:a.jsxs(D,{className:"max-w-4xl max-h-[90vh] overflow-y-auto",children:[a.jsxs(k,{children:[a.jsx(T,{children:"Histórico de Aspirações"}),a.jsx(b,{children:n?`Aspirações da doadora: ${n}`:"Histórico completo de aspirações"})]}),j?a.jsx("div",{className:"py-8",children:a.jsx(g,{})}):a.jsx("div",{className:"mt-4",children:d.length===0?a.jsx("p",{className:"text-center text-slate-500 py-8",children:"Nenhuma aspiração registrada para esta doadora"}):a.jsxs(H,{children:[a.jsx(M,{children:a.jsxs(p,{children:[a.jsx(s,{children:"Data"}),a.jsx(s,{children:"Quantidade de Oócitos"}),a.jsx(s,{children:"Veterinário"}),a.jsx(s,{children:"Técnico"})]})}),a.jsx(_,{children:d.map(e=>a.jsxs(p,{children:[a.jsx(r,{children:L(e.data_aspiracao)}),a.jsx(r,{className:"font-medium",children:e.total_oocitos??"-"}),a.jsx(r,{children:e.veterinario_responsavel||"-"}),a.jsx(r,{children:e.tecnico_responsavel||"-"})]},e.id))})]})})]})})}export{q as D,P as G,R as H,S as P};
