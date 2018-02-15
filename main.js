import PackageDepends from "./package-depends.js"

export async function main( target){
	target= target|| process.argv[2]|| process.cwd()

	var instance= new PackageDepends( target)
	for await( var dep of instance.depends()){
		console.log( dep)
	}
}
export default main
