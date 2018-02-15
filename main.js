import PackageDepends from "./package-depends.js"

export async function main( target){
	target= target|| process.argv[2]|| process.cwd()

	var
	  instance= new PackageDepends( target),
	  cwd= process.cwd()
	for await( var dep of instance.depends()){
		if( dep.startsWith( cwd)){
			dep= dep.slice( cwd.length+ 1)
		}
		console.log( dep)
	}
}
export default main
