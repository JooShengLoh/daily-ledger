/* Patch list content without replacing unchanged rows, focus, or open menus. */
(() => {
  const cache=new WeakMap();
  function sync(parent,source){
    const keyed=new Map([...parent.childNodes].filter(n=>n.nodeType===1&&n.dataset.liveKey).map(n=>[n.dataset.liveKey,n]));
    let position=parent.firstChild;
    for(const wanted of [...source.childNodes]){
      const key=wanted.nodeType===1?wanted.dataset.liveKey:null;
      let current=key?keyed.get(key):position;
      if(current?.nodeType===1&&current.dataset.liveKey&&!key)current=null;
      if(!current||current.nodeType!==wanted.nodeType||current.nodeName!==wanted.nodeName){
        current=wanted.cloneNode(true);parent.insertBefore(current,position);
      }else{
        if(current!==position)parent.insertBefore(current,position);
        if(current.nodeType===3){if(current.data!==wanted.data)current.data=wanted.data;}
        else if(current.nodeType===1){
          for(const attr of [...current.attributes]){
            if(current.tagName==='DETAILS'&&attr.name==='open')continue;
            if(!wanted.hasAttribute(attr.name))current.removeAttribute(attr.name);
          }
          for(const attr of wanted.attributes){if(current.getAttribute(attr.name)!==attr.value)current.setAttribute(attr.name,attr.value);}
          sync(current,wanted);
        }
      }
      position=current.nextSibling;
    }
    while(position){const next=position.nextSibling;position.remove();position=next;}
  }
  window.LiveDOM={html(element,html){
    if(cache.get(element)===html)return;
    const template=document.createElement('template');template.innerHTML=html;
    sync(element,template.content);cache.set(element,html);
  }};
})();
