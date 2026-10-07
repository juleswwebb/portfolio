import {solveModel} from './fea-engine.mjs';
self.onmessage=({data})=>{
  try{self.postMessage({revision:data.revision,result:solveModel(data.model)});}
  catch(error){self.postMessage({revision:data.revision,error:error.message});}
};
