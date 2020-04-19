[Version="1.0.0"]
section sectionTest;

firstMember = 1;
secondMember = "static string";
thirdMember = () => true;

shared letMember =
    let
        a = 1,
        b = 2,
        c = 3
    in
        c;
