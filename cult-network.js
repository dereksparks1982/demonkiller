/* Demon Killer cult hierarchy, built for the existing engine-free Canvas game.
 * A radial investigation board inspired by the structure of Odyssey's cult menu.
 * The public DOM never carries the actual ID or name of an unrevealed cult member.
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.DemonKillerCultNetwork=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const BRANCHES=Object.freeze([
    {id:'faith',name:'FAITH'},
    {id:'wealth',name:'WEALTH'},
    {id:'law',name:'LAW'},
    {id:'shadows',name:'SHADOWS'}
  ]);
  const CATEGORIES={
    'magistrate':'law','council clerk':'law','watch captain':'law','night watchman':'law',
    'notary':'law','schoolteacher':'law',
    'merchant':'wealth','guild treasurer':'wealth','innkeeper':'wealth',
    'apothecary':'wealth','grocer':'wealth',
    'archivist':'faith','bell keeper':'faith','undertaker':'faith',
    'physician':'faith','groundskeeper':'faith',
    'stonemason':'shadows','ferryman':'shadows','stablekeeper':'shadows',
    'tailor':'shadows','steward':'shadows','courier':'shadows',
    'locksmith':'shadows','market porter':'shadows'
  };
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  function branchOf(person){
    const specified=String(person.branch||'').toLowerCase();
    if(BRANCHES.some(b=>b.id===specified))return specified;
    if(person.id==='temple_ritualist'||specified==='temple')return 'faith';
    return CATEGORIES[String(person.occupation||'').toLowerCase()]||'shadows';
  }
  function projection(world,cult){
    if(!cult.valid(world))throw Error('Invalid cult world for hierarchy.');
    const groups=BRANCHES.map(b=>({id:b.id,name:b.name,nodes:[]}));
    const all=Object.values(world.citizens||{});
    for(const person of all){
      if(!person.everMember)continue;
      // Previous members remain on the board; a missing person doesn't
      // disappear just because their unseen allegiance changed.
      const k=own(world.knowledge,person.id)?world.knowledge[person.id]:null;
      const known=!!(k&&k.intel&&k.intel.status==='confirmed');
      const confirmed=known?cult.dossier(world,person.id):null;
      const branch=branchOf(person);
      const node={
        id:person.id,branch,
        confirmed:!!confirmed,
        // Publicly visible only after membership evidence, not after meeting.
        name:confirmed?confirmed.name:null,
        occupation:confirmed?confirmed.occupation:null,
        position:confirmed?confirmed.rank:null,
        clues:confirmed?confirmed.evidence:[],
        eliminated:!!(confirmed&&world.history.some(e=>e.id===person.id&&e.kind==='killed')),
        active:person.active,
        tracking:world.trackedCultistId===person.id
      };
      const group=groups.find(b=>b.id===branch);
      group.nodes.push(node);
    }
    for(const group of groups)group.nodes.sort((a,b)=>{
      // Preserve the hierarchical framing without exposing hidden rank.
      const ax=a.confirmed&&a.position==='leader'?0:1;
      const bx=b.confirmed&&b.position==='leader'?0:1;
      return ax-bx||a.id.localeCompare(b.id);
    });
    const leads=cult.board(world).filter(x=>x.affiliation==='suspected');
    return {branches:groups,leads,confirmed:groups.reduce((n,g)=>n+g.nodes.filter(x=>x.confirmed).length,0)};
  }
  function el(doc,tag,css,text){
    const node=doc.createElement(tag);
    if(css)node.className=css;
    if(text!==undefined)node.textContent=text;
    return node;
  }
  function mount(opts){
    const {document:doc,cult,getWorld,save}=opts||{};
    if(!doc||!cult||typeof getWorld!=='function'||typeof save!=='function')
      throw Error('Cult hierarchy needs game context.');
    const list={},board=doc.getElementById('cultNetwork');
    const detail=doc.getElementById('cultNodeDetails');
    const leads=doc.getElementById('cultLooseLeads');
    const summary=doc.getElementById('cultNetworkStatus');
    if(!board||!detail||!leads||!summary)throw Error('Cult hierarchy DOM is missing.');
    for(const b of BRANCHES){
      list[b.id]=doc.getElementById('cultBranch_'+b.id);
      if(!list[b.id])throw Error('Missing cult branch '+b.id);
    }
    let chosenId=null;
    function detailFor(selected){
      detail.replaceChildren();
      if(!selected){
        detail.append(el(doc,'h3','','SELECT A CULTIST'),
          el(doc,'p','','Choose a silhouette to examine the evidence you have uncovered.'));
        return;
      }
      const title=selected.confirmed?selected.name:'IDENTITY UNKNOWN';
      detail.append(el(doc,'h3','',title));
      detail.append(el(doc,'div','cult-detail-portrait'+(selected.confirmed?' cult-detail-revealed':''),
        selected.confirmed?selected.name.slice(0,1).toUpperCase():'?'));
      detail.append(el(doc,'p','cult-detail-status',selected.eliminated?'ELIMINATED':
        selected.confirmed?'IDENTIFIED':'UNIDENTIFIED'));
      if(!selected.confirmed){
        detail.append(el(doc,'p','','Find clues and confirm who occupies this position. Public reputation alone is not proof.'));
        return;
      }
      detail.append(el(doc,'p','','Known occupation: '+selected.occupation));
      if(selected.position&&selected.position!=='unknown')
        detail.append(el(doc,'p','','Last verified rank: '+selected.position.toUpperCase()));
      detail.append(el(doc,'h4','','DISCOVERED CLUES'));
      if(!selected.clues.length)detail.append(el(doc,'p','','No clues recorded.'));
      else for(const clue of selected.clues)
        detail.append(el(doc,'p','cult-clue',clue.title+(clue.source?' · '+clue.source:'')));
      if(!selected.eliminated){
        const track=el(doc,'button','cult-track',selected.tracking?'STOP TRACKING':'MARK FOR TRACKING');
        track.type='button';
        track.addEventListener('click',()=>{
          const world=getWorld();
          world.trackedCultistId=world.trackedCultistId===selected.id?null:selected.id;
          save();refresh();
        });
        detail.append(track);
        detail.append(el(doc,'p','cult-detail-foot',
          'Tracking marker only. Finding or confronting this person requires a playable location.'));
      }
    }
    function refresh(){
      const world=getWorld();if(!world)return;
      const view=projection(world,cult);
      summary.textContent=view.confirmed+' IDENTIFIED · '+view.leads.length+' UNVERIFIED LEADS';
      let selected=null;
      for(const branch of view.branches){
        const root=list[branch.id];root.replaceChildren();
        if(!branch.nodes.length){
          root.append(el(doc,'p','cult-branch-empty','NO CONFIRMED CONNECTIONS'));
          continue;
        }
        for(const member of branch.nodes){
          const node=el(doc,'button','cult-member'+(member.confirmed?' cult-known':'')+
            (member.eliminated?' cult-eliminated':'')+
            (member.tracking?' cult-tracked':'')+
            (member.id===chosenId?' cult-selected':''));
          node.type='button';
          node.setAttribute('aria-label',member.confirmed?('Cult member: '+member.name):'Unidentified cult member');
          const portrait=el(doc,'span','cult-member-face',
            member.confirmed?member.name.slice(0,1).toUpperCase():'?');
          portrait.setAttribute('aria-hidden','true');
          const caption=el(doc,'span','cult-member-name',
            member.confirmed?member.name:'UNKNOWN');
          node.append(portrait,caption);
          node.addEventListener('click',()=>{chosenId=member.id;refresh();});
          root.append(node);
          if(member.id===chosenId)selected=member;
        }
      }
      detailFor(selected);
      leads.replaceChildren();
      if(!view.leads.length)leads.append(el(doc,'p','cult-leads-empty',
        'No unverified suspects. Discover evidence in the world.'));
      else for(const lead of view.leads){
        const row=el(doc,'article','cult-lead');
        row.append(el(doc,'strong','',lead.name),
          el(doc,'span','','SUSPECTED · NOT CONFIRMED'));
        for(const clue of lead.evidence)
          row.append(el(doc,'p','',clue.title));
        leads.append(row);
      }
    }
    const master=doc.getElementById('cultMasterCard');
    if(master)master.addEventListener('click',()=>{
      chosenId=null;
      refresh();
      detail.replaceChildren(
        el(doc,'h3','','THE UNKNOWN LEADER'),
        el(doc,'p','','The central leadership remains unidentified. Investigate the branches to uncover it.')
      );
    });
    refresh();
    return Object.freeze({refresh});
  }
  return Object.freeze({BRANCHES,branchOf,projection,mount});
});