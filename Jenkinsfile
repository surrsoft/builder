@Library('pipeline') _

def version = '20.3000/bugfix/fix_coverage_builds_fail'

node ('controls') {
    checkout_pipeline("rc-${version}")
    run_branch = load '/home/sbis/jenkins_pipeline/platforma/branch/run_branch'
    run_branch.execute('builder', version)
}