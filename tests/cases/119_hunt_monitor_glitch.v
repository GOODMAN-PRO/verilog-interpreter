module t;
reg c;
initial begin c=0;
$monitor("c=%b at %0t", c, $time);
#1 begin c=1; c=0; end
#1 begin c=1; #0 c=0; end
#1 c=0;
end
endmodule
