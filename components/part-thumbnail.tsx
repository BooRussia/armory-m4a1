import Image from 'next/image';
import { CircleSlash } from 'lucide-react';
import { publicAsset } from '@/lib/public-asset';

export function PartThumbnail({id,className=''}:{id:string|null;className?:string}) {
  return <span className={'part-thumbnail '+className} aria-hidden="true">
    {id?<Image src={publicAsset('/assets/m4a1/thumbnails/'+id+'.png')} alt="" width={320} height={240} unoptimized draggable={false}/>:<CircleSlash strokeWidth={1}/>}
  </span>;
}
