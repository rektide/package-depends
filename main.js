import PackageDepends from "./package-depends.js"

export async function main( target){
	target= target|| process.argv[2]|| process.cwd()

	var
	  instance= new PackageDepends({ base: target}),
	  cwd= process.cwd()
	for await( var dep of instance.depends()){
		if( dep.startsWith( target)){
			dep= dep.slice( target.length+ 1)
		}
		console.log( dep)
	}
}
export default main
