import json
from itertools import combinations


def create_regex(iterable):
    iterable.sort(key=lambda s: len(s), reverse=True)
    base = "|".join(["({})".format(i) for i in iterable])
    return wrap_regex(base)


def wrap_regex(base):
    return "\\\\b({})\\\\b".format(base)


def assert_disjoint_sets(*args):
    for comb in combinations(args, 2):
        (left, right) = comb
        left = set(left)
        right = set(right)
        maybe_disjoint = left & right
        assert len(maybe_disjoint) == 0, json.dumps(
            {
                "left": list(left),
                "right": list(right),
                "maybe_disjoint": list(maybe_disjoint),
            },
            indent=4,
        )


control = [
    "each",
    "else",
    "error",
    "if",
    "in",
    "let",
    "otherwise",
    "then",
    "try",
]

constant = [
    "false",
    "true",
]

operator = [
    "and",
    "as",
    "is",
    "not",
    "or",
]

other = [
    "meta",
    "section",
    "shared",
    "type",
]

hash_other = [
    "binary",
    "date",
    "datetime",
    "datetimezone",
    "duration",
    "infinity",
    "nan",
    "sections",
    "table",
    "time",
]

assert_disjoint_sets(control, constant, operator, other, hash_other)

print("keyword.control.powerquery")
print(create_regex(control))
print()

print("keyword.constant.language.powerquery")
print(create_regex(constant))
print()

print("keyword.operator.powerquery")
print(create_regex(operator))
print()

print("keyword.other.powerquery")
print(create_regex(other))
print()
