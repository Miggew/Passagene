import{c as t,r as c,s as y,j as a,g,k}from"./index-CvlUDCD-.js";import{D as v,b as D,c as T,d as b,e as H}from"./dialog-DSJKtNd7.js";import{T as L,a as M,b as p,c as e,d as _,e as r}from"./table-BAfLAU-a.js";import{u as E}from"./use-toast-BhbfqK05.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const z=t("Gem",[["path",{d:"M6 3h12l4 6-10 13L2 9Z",key:"1pcd5k"}],["path",{d:"M11 3 8 9l4 13 4-13-3-6",key:"1fcu3u"}],["path",{d:"M2 9h20",key:"16fsjt"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const C=t("History",[["path",{d:"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",key:"1357e3"}],["path",{d:"M3 3v5h5",key:"1xhq8a"}],["path",{d:"M12 7v5l4 2",key:"1fdv2h"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const G=t("Pencil",[["path",{d:"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",key:"1a8usu"}],["path",{d:"m15 5 4 4",key:"1mk7zo"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const P=t("Star",[["path",{d:"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z",key:"r04s7s"}]]);function q({doadoraId:i,doadoraNome:l,open:o,onClose:x}){const[n,m]=c.useState([]),[j,d]=c.useState(!1),{toast:f}=E();c.useEffect(()=>{o&&i&&u()},[o,i]);const u=async()=>{try{d(!0);const{data:s,error:h}=await y.from("aspiracoes_doadoras").select("*").eq("doadora_id",i).order("data_aspiracao",{ascending:!1});if(h)throw h;m(s||[])}catch(s){f({title:"Erro ao carregar histórico",description:s instanceof Error?s.message:"Erro desconhecido",variant:"destructive"})}finally{d(!1)}};return a.jsx(v,{open:o,onOpenChange:x,children:a.jsxs(D,{className:"max-w-4xl max-h-[90vh] overflow-y-auto",children:[a.jsxs(T,{children:[a.jsx(b,{children:"Histórico de Aspirações"}),a.jsx(H,{children:l?`Aspirações da doadora: ${l}`:"Histórico completo de aspirações"})]}),j?a.jsx("div",{className:"py-8",children:a.jsx(g,{})}):a.jsx("div",{className:"mt-4",children:n.length===0?a.jsx("p",{className:"text-center text-slate-500 py-8",children:"Nenhuma aspiração registrada para esta doadora"}):a.jsxs(L,{children:[a.jsx(M,{children:a.jsxs(p,{children:[a.jsx(e,{children:"Data"}),a.jsx(e,{children:"Quantidade de Oócitos"}),a.jsx(e,{children:"Veterinário"}),a.jsx(e,{children:"Técnico"})]})}),a.jsx(_,{children:n.map(s=>a.jsxs(p,{children:[a.jsx(r,{children:k(s.data_aspiracao)}),a.jsx(r,{className:"font-medium",children:s.total_oocitos??"-"}),a.jsx(r,{children:s.veterinario_responsavel||"-"}),a.jsx(r,{children:s.tecnico_responsavel||"-"})]},s.id))})]})})]})})}export{q as D,z as G,C as H,G as P,P as S};
