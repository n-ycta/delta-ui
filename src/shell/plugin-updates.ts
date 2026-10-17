/** UI and process versions are independent parts of the same plugin entry. */
export function hasUiUpdate(id:string, installed:readonly {id:string;version:string}[], catalog:readonly {id:string;version:string}[]) {
  const current=installed.find(p=>p.id===id),latest=catalog.find(p=>p.id===id);
  return !!current && !!latest && current.version!==latest.version;
}
